# 測驗系統實作說明

`index.html` 測驗引擎的技術文件，涵蓋架構、資料模型、控制流程，以及關鍵演算法（加權抽樣、選項打亂、本地持久化）。

## 概觀

單頁、零建置、純 vanilla JS 的測驗應用。整個 runtime 由兩個檔案組成：

| 檔案 | 職責 |
|---|---|
| [`index.html`](../index.html) | 標記、樣式、render 函式、狀態、控制器 |
| [`config.js`](../config.js) | 靜態設定（科目、主題、題庫來源、儲存鍵） |

題庫於應用啟動時非同步從 `subjects/*/questions.json` 載入。作答歷史保存在 `localStorage`。無後端、無 build step、無框架依賴。

## 技術堆疊

- **執行環境：** 僅瀏覽器。需透過 HTTP 伺服器執行（不可使用 `file://`），因題庫採非同步 fetch。
- **JavaScript：** ES2020+ 原生語法（`async/await`、optional chaining、template literals），無 transpiler。
- **CSS：** 手寫，無 utility framework。
- **持久化：** `localStorage`（單一 key，JSON 序列化陣列）。
- **遙測：** Vercel Web Analytics script tag，無 library 引入。

## 專案結構

```
ipas-quiz-pdf/
├── index.html              # UI、狀態、控制器全部於此
├── config.js               # 科目／主題／題庫設定（於主腳本前載入）
├── subjects/
│   ├── 1-ai/
│   │   ├── questions.json  # s1 科目題庫
│   │   ├── study-guide.pdf
│   │   └── past-exam.pdf
│   ├── 2-bigdata/          # s2
│   ├── 3-ml/               # s3
│   ├── entry-1-ai/         # e1
│   └── entry-2-genai/      # e2
└── shared/                 # 共用資源（圖片、範例 PDF）
```

科目代碼（`s1`／`s2`／`s3`／`e1`／`e2`）為貫穿狀態、儲存、設定的標準識別碼。顯示名稱定義於 `SUBJECTS[code].short` ／ `.long`。

## 資料模型

### 題目（Question）

`subjects/<subject>/questions.json` 內每筆資料須符合以下結構：

```ts
interface Question {
  id: string;                    // 全科目唯一，例如 "exam-114-2-q1"
  subject_code: "s1"|"s2"|"s3"|"e1"|"e2";  // 載入時依 POOL_SOURCES key 注入
  topic: string;                 // 階層式、以 "/" 分隔，例如 "NLP/Sentiment"
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: "A"|"B"|"C"|"D";
  source: { file: string; page: number };  // 相對於 index.html 的路徑
  explanation?: string;          // Markdown 格式，經 renderMarkdown() 渲染
  image?: string;                // 選填，題目附圖路徑
  generated?: boolean;           // 若為 AI 補充題顯示「新題」徽章
  display_order?: ("A"|"B"|"C"|"D")[];  // 啟用打亂時於 runtime 注入
}
```

### 回合（Round）

回合為持久化單位，一場測驗對應一個 round：

```ts
interface Round {
  questions: Question[];
  responses: Response[];
  subject_code: string;
  scope: string;                 // 摘要文字「AI · NLP · 10 題」
  shuffled: boolean;
  started: string;               // ISO 8601
  completed?: string;            // 結束時填入 ISO 8601
}

interface Response {
  q_id: string;
  user_answer: "A"|"B"|"C"|"D";  // 以「原始字母」儲存，非顯示順序
  is_correct: boolean;
  ts: string;
}
```

### 應用狀態

單一可變全域，位於 [index.html:448](../index.html#L448)：

```js
let state = {
  view: "home" | "quiz" | "results" | "history",
  round: Round | null,
  selected: "A"|"B"|"C"|"D" | null,  // 以「顯示字母」儲存
  answered: boolean,
  showWhy: boolean,
  levelFilter: "intermediate"|"entry",
  subjectFilter: string,
};
```

核心更新迴圈：**修改 `state` → 呼叫 `render()` → 經 `innerHTML` 重寫 DOM**。

## 模組邊界

`config.js` 以 classic（非 module）script 方式於 `index.html` 內嵌腳本之前載入，曝露下列 script-scope 全域變數：

| 識別字 | 型別 | 用途 |
|---|---|---|
| `STORAGE_KEY` | `string` | 持久化回合的 localStorage 鍵 |
| `WRONG_BOOST` | `number` | 未解決錯題的權重倍率（spaced repetition） |
| `POOL_SOURCES` | `Record<SubjectCode, string>` | 科目代碼 → 題庫 JSON URL |
| `SOURCE_PDF_MAP` | `Record<string, string>` | 舊檔名對照表（目前為空） |
| `LEVELS` | `Record<string, string>` | 級別代碼 → 顯示文字 |
| `SUBJECTS` | `Record<SubjectCode, SubjectMeta>` | 科目 metadata（級別、名稱、學習指引路徑） |
| `TOPIC_REFS` | `Record<SubjectCode, Record<Topic, Ref>>` | 主題 → 學習指引章節／節次／頁碼 |

新增科目時，於 `POOL_SOURCES`、`SUBJECTS`（與可選的 `TOPIC_REFS`）擴充對應條目，再將 `questions.json` 放入 `subjects/<name>/` 即可。

## 應用生命週期

```
┌─────────────────────────────────────────────────────┐
│ 1. config.js 評估完成 → 全域註冊                      │
│ 2. index.html 內嵌腳本執行                            │
│ 3. loadPool() 平行 fetch 所有 POOL_SOURCES            │
│ 4. POOL 由各科目陣列展平合併                          │
│ 5. render() 依 state.view 分派                       │
└─────────────────────────────────────────────────────┘
```

[`loadPool()`](../index.html#L412)：

```js
async function loadPool() {
  const entries = Object.entries(POOL_SOURCES);
  const results = await Promise.all(entries.map(async ([code, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }));
  POOL = results.flat();
}
```

載入失敗時，`showLoadError()` 顯示一張說明卡，提示 `file://` 不支援。

## 渲染流程

[`render()`](../index.html#L628) 為輕量分派函式：

```js
function render() {
  const app = document.getElementById("app");
  if (state.view === "home")    app.innerHTML = renderHome();
  else if (state.view === "quiz")    app.innerHTML = renderQuiz();
  else if (state.view === "results") app.innerHTML = renderResults();
  else if (state.view === "history") app.innerHTML = renderHistory();
}
```

每支 `renderXxx()` 經 template literal 組出完整 HTML 字串。設計取捨：

- ✅ 無框架、無 virtual DOM、無 diff 機制，可讀性高。
- ✅ render 函式為純函式：`(state) → string`。
- ❌ `innerHTML` 整段替換會丟失 DOM 本地狀態（focus、捲軸、未送出表單）。本專案可接受，因題目卡完全由 `state` 推導。

### 標記跳脫

對使用者顯示的字串均經 `escapeHtml()` 後再插值。解析內容為 Markdown，由 `renderMarkdown()`（支援粗體、行內 code、bullet、段落）處理，內部同樣會跳脫原始輸入。

## 測驗回合流程

### 開始

[`startRound()`](../index.html#L1049) 讀取表單值，呼叫 `pickQuestions()`，建立 round：

```js
state.round = {
  questions,
  responses: [],
  subject_code: subjectCode,
  scope: `${subjectLabel} · ${topicLabel} · ${questions.length} 題`,
  shuffled: shuffleOpts,
  started: new Date().toISOString()
};
state.view = "quiz";
render();
```

### 選項作答

[`selectOption()`](../index.html#L1078) 紀錄選擇並重新渲染以顯示回饋：

```js
function selectOption(letter) {
  if (state.answered) return;
  state.selected = letter;
  state.answered = true;
  render();
}
```

`letter` 屬於「顯示字母」空間（使用者點選的視覺位置）。直到 `nextQuestion()` 提交時才會轉回原始字母。

鍵盤快捷鍵：A/B/C/D 觸發 `selectOption()`；Enter 觸發 `nextQuestion()`；W 切換解析面板。見 `index.html` 底部的全域 `keydown` listener。

### 進入下一題

[`nextQuestion()`](../index.html#L1085) 將顯示字母轉回原始字母（確保統計與打亂設定無關），推入 response，並判斷推進或結束：

```js
const order = q.display_order || ["A","B","C","D"];
const origLetter = order[["A","B","C","D"].indexOf(state.selected)];
state.round.responses.push({
  q_id: q.id,
  user_answer: origLetter,
  is_correct: origLetter === q.correct_answer,
  ts: new Date().toISOString()
});

if (state.round.responses.length >= state.round.questions.length) {
  state.round.completed = new Date().toISOString();
  appendRound(state.round);
  state.view = "results";
}
```

## 加權抽樣（Spaced Repetition）

[`pickQuestions()`](../index.html#L539) 實作不放回加權抽樣：

```js
const weights = pool.map(q => 1 + WRONG_BOOST * (wrongMap.get(q.id) || 0));
return weightedSampleNoReplace(pool, weights, count);
```

權重公式：

```
weight(q) = 1 + WRONG_BOOST × unresolvedWrongCount(q)
         = 1 + 4 × unresolvedWrongCount(q)
```

`unresolvedWrongCount(q)` 由 [`getWrongCountMap()`](../index.html#L483) 推導：依時間順序走訪所有歷史 response，每次錯誤累加、每次正確則**重置為零**。換言之，一旦答對該題，spaced-repetition 增益即歸零，題目恢復為基準權重。

實例：錯一次 → 權重 5（抽中機率為基準的 5 倍）；錯兩次 → 9；之後答對一次 → 重置為 1。

## 選項打亂

啟用「隨機打亂」時，每題於回合建立階段取得一組 `display_order` 排列：

```js
display_order: shuffleOpts ? shuffle(["A","B","C","D"]) : ["A","B","C","D"]
```

渲染時以「顯示位置 → 原始字母」對照查詢 `q.options`：

```js
order.map((origLetter, i) => {
  const displayLetter = ["A","B","C","D"][i];
  // displayLetter 為視覺位置；origLetter 為實際答案鍵
  return `<input value="${displayLetter}"> ${displayLetter}. ${q.options[origLetter]}`;
});
```

兩個衍生規則：

1. **Response 以原始字母儲存**（見上方 `nextQuestion()`），確保答對率統計不受打亂設定影響。
2. **解析以原始字母撰寫**。`translateExplanation()`（[index.html:559](../index.html#L559)）會將「為什麼 X 是」與條列字首的字母重寫為顯示字母，並重排條列順序使顯示空間中仍為 A→D。

## 持久化

所有回合歷史共用單一 localStorage 鍵：

```js
const STORAGE_KEY = "test-prep-rounds-v1";
```

API（[index.html:456](../index.html#L456)）：

| 函式 | 用途 |
|---|---|
| `getRounds()` | 回傳 `Round[]`，能處理缺失或損毀的資料 |
| `saveRounds(rounds)` | 整個陣列覆寫 |
| `appendRound(round)` | 讀 → push → 寫 |
| `exportData()` | 以 Blob 形式下載 `test-prep-history.json` |
| `resetData()` | 確認後執行 `localStorage.removeItem(STORAGE_KEY)` |

回合歷史的下游消費端：

- **首頁累計成績** — 依科目過濾後加總 `responses.is_correct`。
- **弱點主題** — `getWeakTopics()` 統計每個主題的錯題數。
- **累計錯題** — `getCumulativeWrongs()` 列出所有未解決的錯題。
- **加權抽題** — `getWrongCountMap()` 餵給 `pickQuestions()`。

儲存格式向前相容：寫入時未知欄位會保留，讀取時容許可選欄位缺失。

## UI 慣例

- **卡片外框：** 所有 `.card` 套用 Windows 風格視窗框（細深邊、Aero 藍標題列、drop shadow）。題目卡片於標題列右側（`.title-right`）放置主題徽章與選填的「新題」徽章。
- **選項版面：** 原生 `<input type="radio">` 包於 `<label>`，後接字母（如 `A.`）與選項文字。Radio 透過 `accent-color: var(--accent)` 著色；答對／答錯／揭曉正解狀態會切換 `accent-color` 為對應語意色（綠／紅）。
- **主要按鈕：** `.btn-primary` 為 Windows 7 風銀色按鈕，hover 時顯示藍色光暈。用於「開始作答」、「下一題」、「看結果」等推進操作。
- **字型：** body 字型為 PMingLiU 及 fallback；題目文字 `font-weight: 700`。

## 設定參考

### 新增科目

1. 建立 `subjects/<name>/questions.json`，內容為 `Question[]`（無需填 `subject_code`，由 loader 注入）。
2. 在 `config.js` 增加：
   ```js
   POOL_SOURCES.s4 = "subjects/<name>/questions.json";
   SUBJECTS.s4 = {
     level: "intermediate",
     short: "科目四 · ...",
     long: "iPAS ... 科目四 ...",
     study_guide: "subjects/<name>/study-guide.pdf"
   };
   ```
3. （可選）於 `TOPIC_REFS.s4 = { ... }` 加入「延伸閱讀」對照。

### 調整 Spaced Repetition 曲線

`config.js` 內的 `WRONG_BOOST` 控制錯題重抽積極程度。值越大越偏弱點補強；越小越接近均勻抽樣。

### 新增題目數量選項

於 `renderHome()`（[index.html:636](../index.html#L636)）內編輯 `<select id="round-size">`。`999` 為 sentinel，代表「該主題池內全部題目」— 抽題函式對 `>= pool.length` 的數量一律視為全選。

## 檔案索引

| 模組／主題 | 位置 |
|---|---|
| 題庫載入 | [index.html:412](../index.html#L412) |
| 應用狀態 | [index.html:448](../index.html#L448) |
| 持久化函式 | [index.html:456](../index.html#L456) |
| 加權抽樣 | [index.html:539](../index.html#L539) |
| 解析翻譯 | [index.html:559](../index.html#L559) |
| `render()` 分派 | [index.html:628](../index.html#L628) |
| 首頁畫面 | [index.html:636](../index.html#L636) |
| 答題畫面 | [index.html:757](../index.html#L757) |
| `startRound()` | [index.html:1049](../index.html#L1049) |
| `selectOption()` | [index.html:1078](../index.html#L1078) |
| `nextQuestion()` | [index.html:1085](../index.html#L1085) |
| `exportData()` | [index.html:1147](../index.html#L1147) |
| 設定全域 | [config.js](../config.js) |
