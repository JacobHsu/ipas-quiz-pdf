# PR 自動化審查

使用本地 Claude Code + GitHub CLI 進行 PR code review 的技術文件，涵蓋日常使用、原理、以及在其他 repo 從零建置的完整步驟。

## 概觀

本 repo 提供 `/pr-review <PR_NUMBER>` slash command，讓開發者在本地 Claude Code 對話中一行觸發 PR 審查流程。

**不需要：**
- ❌ Anthropic API key
- ❌ GitHub Actions 設定
- ❌ 第三方 bot 或 webhook 服務
- ❌ 任何雲端基礎設施

**需要：**
- ✅ 本地裝好 Claude Code（使用個人 Claude 訂閱）
- ✅ 本地裝好 `gh` CLI 並完成 `gh auth login`

審查報告全程在本地生成，使用者可選擇是否貼回 PR。所有寫入操作（`gh pr comment`、`gh pr review`）都會觸發權限確認，刻意設計以防止自動化情境誤觸 approve / request-changes。

## 技術堆疊

- **執行環境：** 本地 Claude Code CLI（任何平台）
- **GitHub 整合：** `gh` CLI（無需自建 GitHub App 或 webhook）
- **指令格式：** Claude Code slash command（markdown + frontmatter）
- **權限模型：** `allowed-tools` whitelist（讀操作預先授權，寫操作每次確認）

## 使用方式（給團隊成員）

### 前置作業（每位成員一次性）

1. **安裝 Claude Code**：依官方說明於本機安裝並登入 Anthropic 帳號
2. **安裝 `gh` CLI**：
   ```bash
   # macOS
   brew install gh
   # Windows
   winget install --id GitHub.cli
   # Linux
   # 參考 https://github.com/cli/cli/blob/trunk/docs/install_linux.md
   ```
3. **GitHub 登入**：
   ```bash
   gh auth login
   ```
   選 GitHub.com → HTTPS → 用瀏覽器登入即可。

### 日常使用

在這個 repo 的根目錄開啟 Claude Code 對話，輸入：

```
/pr-review 5
```

（將 `5` 換成你要審查的 PR 編號）

Claude 會自動執行：

1. `gh pr view 5 --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles` — 抓 PR 中繼資料
2. `gh pr diff 5` — 抓完整 diff
3. `gh pr checks 5` — 看 CI 狀態
4. 必要時用 `Read` 工具讀完整原始檔補足 context
5. 產出分級審查報告
6. 詢問是否貼回 PR

### 報告格式

每次審查產出固定四級報告：

| 級別 | 意義 | 行動 |
|---|---|---|
| 🔴 **Critical** | 安全漏洞、資料風險、破壞性變更 | 必須擋下 |
| 🟠 **High** | 邏輯錯誤、未處理錯誤、效能問題、違反 convention | 強烈建議修 |
| 🟡 **Medium** | 可讀性、a11y、UX、重複碼 | 建議修 |
| 🔵 **Nit** | 格式、typo、風格偏好 | 選擇性 |

結尾固定給結論之一：

- ✅ **Approve** — 無 Critical / High，可直接 merge
- 🔧 **Approve with suggestions** — 有 Medium 建議但不擋 merge
- ❌ **Request changes** — 有 Critical 或 High，需修正後再 review

### 是否貼回 PR

報告完成後，Claude 會問：

```
要把這份 review 貼回 PR 嗎？
A · gh pr comment N — 一般 comment
B · gh pr review N --comment — 正式 review（顯示在 Files changed tab）
C · 不貼，只在本地看
```

**選 A 或 B 時會跳權限確認**，這是刻意設計：寫入 GitHub 的操作必須當下確認，防止 LLM 在自動化情境誤觸。

### 適合場景

| 場景 | 是否適合 |
|---|---|
| 自己 review 自己的 PR（commit 前自審） | ✅ 強烈推薦 |
| 補強 CodeRabbit / 其他 bot 沒抓到的 a11y / UX / 業務邏輯 | ✅ 推薦 |
| 學習如何審查程式碼（看 Claude 怎麼分級） | ✅ 推薦 |
| 取代人類 reviewer 完全自動化 merge | ❌ 不適合（仍需人類最終決策） |
| 大型 PR（1000+ 行 diff） | ⚠️ context 可能不足，建議拆 PR |

### 與 CodeRabbit 等 bot 的關係

本 repo 已安裝 CodeRabbit，每個 PR 會自動產生 bot review。`/pr-review` 設計上會：

- 提一句承認 bot 的 review 存在
- **不重複** bot 已抓到的點
- 補充 bot 常忽略的角度：無障礙、國際化、UX 細節、業務邏輯一致性

兩者互補而非取代。

## 手動執行流程（不使用 slash command）

當你想理解 `/pr-review` 背後到底跑了什麼、在沒裝指令的 repo 臨時做一次審查、或用其他 AI 工具（不是 Claude Code）跑相同流程時，可以照下面步驟手動操作。

整個流程就是「**用 `gh` 把 PR 資訊抓下來 → 餵給 AI 分析 → 把結果貼回去**」，沒有魔法。

### Step 1：抓 PR metadata

```bash
gh pr view 5 --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles
```

輸出範例：

```json
{
  "title": "feat: replace correct answer pill with inline checkmark",
  "body": "## Summary\n- ...",
  "author": {"login": "JacobHsu"},
  "baseRefName": "main",
  "headRefName": "feat/correct-answer-checkmark",
  "additions": 3,
  "deletions": 3,
  "changedFiles": 1
}
```

**用途**：知道 PR 的範圍大小（additions/deletions/changedFiles），決定要不要拆審；看作者描述的意圖，對照 diff 是否一致。

### Step 2：抓完整 diff

```bash
gh pr diff 5
```

輸出是標準 unified diff 格式。如果 diff 很大想存檔：

```bash
gh pr diff 5 > /tmp/pr-5.diff
```

如果只想看特定檔案：

```bash
gh pr diff 5 -- index.html
```

### Step 3：看 CI 狀態

```bash
gh pr checks 5
```

輸出範例：

```
CodeRabbit    pass     0    Review completed
ci/build      pass     45s  Build succeeded
ci/test       fail     12s  3 tests failed
```

**判讀**：
- 全 pass → 可以進入分析階段
- 有 fail → 先檢查失敗的 check，可能 PR 連基本門檻都沒過
- pending → 等 CI 跑完再來，避免基於不完整資訊評論

### Step 4：餵給 AI 分析

把 Step 1-3 的輸出貼給 AI（Claude / ChatGPT / 任何工具），加上下面這段 prompt：

````
請依以下分級對這個 PR 做 code review：

🔴 Critical（必擋）：安全漏洞、資料風險、破壞性變更、邏輯完全失效
🟠 High（強烈建議修）：未處理錯誤、效能問題、違反 convention、測試缺漏
🟡 Medium（建議修）：可讀性、a11y、UX、重複碼
🔵 Nit（選擇性）：格式、typo、風格

每個發現要：
1. 標註檔名:行號
2. 給具體修改 code snippet
3. 解釋 why

結尾給結論：✅ Approve / 🔧 Approve with suggestions / ❌ Request changes

PR metadata:
<貼 Step 1 的 JSON>

Diff:
<貼 Step 2 的 diff>

CI status:
<貼 Step 3 的輸出>
````

> 💡 用 Claude Code 時不用手動貼，直接說「幫我用上面這個 rubric review PR #5，自己用 gh 抓資料」即可。

### Step 5：把報告貼回 PR

收到 AI 的報告後，三選一：

**選項 A · 一般 comment（彈性最高，不影響 PR 狀態）**

```bash
gh pr comment 5 --body "$(cat <<'EOF'
## 🤖 Code Review

### 🟡 Medium
- `index.html:235` — 建議改成圓形 badge ...

### 結論
🔧 Approve with suggestions
EOF
)"
```

**選項 B · 正式 review（顯示在 Files changed tab，可選 approve / request changes）**

```bash
# 純評論
gh pr review 5 --comment --body "..."

# 直接 approve
gh pr review 5 --approve --body "LGTM"

# 要求修改
gh pr review 5 --request-changes --body "請看 Critical 問題"
```

**選項 C · 不貼，只在本地看**

什麼都不做。適合：
- 自己審自己的 code（commit 前自查）
- 個人專案
- 已經有其他 bot 在審，避免噪音

### 從檔案讀 body（避免 shell escape 地獄）

當 review 內容含很多 backtick、引號、特殊字元時，heredoc 容易出錯。可改用檔案：

```bash
# 先把 AI 給的報告存進檔案
cat > /tmp/review.md <<'EOF'
（貼整份 review）
EOF

# 從檔案讀
gh pr comment 5 --body-file /tmp/review.md
# 或
gh pr review 5 --comment --body-file /tmp/review.md
```

### 手動流程的對比

| 步驟 | 手動 | `/pr-review` |
|---|---|---|
| 抓 metadata / diff / checks | 自己打 3 個 `gh` 指令 | 自動跑 |
| 組 prompt | 自己貼資料 + 寫 rubric | 內建 rubric |
| 分級一致性 | 看當下心情 | 永遠四級 |
| 結論格式 | 不一定有 | 強制三選一 |
| 貼回 PR | 自己組 `gh pr comment` 指令 | 提示 A/B/C 讓你選 |
| 防誤觸 approve | 靠自己謹慎 | `allowed-tools` 預設不開放寫操作 |

手動流程的價值在於 **理解原理、debug、適配非 Claude Code 工具**。日常使用還是 `/pr-review` 快。

## 在其他 repo 重頭建置（給想要複製到自己 repo 的人）

完整步驟分五個 step。預估 10 分鐘完成。

### Step 1：確認前置條件

```bash
# 確認 gh 已登入
gh auth status

# 應該看到 ✓ Logged in to github.com account <你的帳號>
# 且 token scopes 含 'repo', 'workflow'
```

如果 token scope 不足，重跑 `gh auth login` 並允許所需權限。

### Step 2：建立 slash command 目錄

在你的 repo 根目錄：

```bash
mkdir -p .claude/commands
```

### Step 3：建立 `/pr-review` 指令檔

建立 `.claude/commands/pr-review.md`，內容如下：

````markdown
---
description: Review a GitHub PR using gh CLI with tiered severity report
argument-hint: <PR_NUMBER>
allowed-tools: Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Read, Grep
---

對 PR #$1 進行 code review。

## 執行步驟

1. **抓 PR metadata**
   ```bash
   gh pr view $1 --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles
   ```

2. **抓完整 diff**
   ```bash
   gh pr diff $1
   ```

3. **看 CI 狀態**
   ```bash
   gh pr checks $1
   ```

4. **必要時讀原始檔**：如果 diff 上下文不足，用 Read 工具讀完整檔案理解 context。

## 審查面向（分級輸出）

依以下面向分析，每個發現都要：
- 標註檔名:行號（用 markdown 連結格式）
- 給出具體修改建議（含 code snippet）
- 解釋 **why**，不只是 what

### 🔴 Critical — 必須擋下
- 安全漏洞（XSS、SQL injection、secrets 外洩、CSRF）
- 資料遺失/破壞風險
- 破壞性 API 變更未標註
- 邏輯錯誤導致功能完全失效

### 🟠 High — 強烈建議修
- 未處理的錯誤路徑
- 效能問題（N+1、不必要的同步操作）
- 違反專案既有 convention
- 測試缺漏或測試品質差

### 🟡 Medium — 建議修
- 可讀性、命名
- 重複碼、可抽出的邏輯
- 無障礙（a11y）退化
- 顏色/形狀依賴等 UX 問題

### 🔵 Nit — 選擇性
- 格式、註解 typo
- 風格偏好

## 報告結尾

最後給出結論之一：
- ✅ **Approve** — 無 Critical/High，可直接 merge
- 🔧 **Approve with suggestions** — 有 Medium 建議但不擋 merge
- ❌ **Request changes** — 有 Critical 或 High，需修正後再 review

## 詢問是否貼回 PR

報告完成後，問使用者要 A / B / C 哪種貼回方式，依使用者回應決定是否執行貼回動作。
**不要自動貼**。`gh pr comment` / `gh pr review` 未列入 allowed-tools，每次貼回都會觸發 permission prompt。

## 注意

- 如果 repo 已有 CodeRabbit 或其他 bot review，提一句並補充 bot 常忽略的角度（a11y、i18n、UX、業務邏輯）
- 不要重複 bot 已經抓到的點
````

> 參考本 repo 完整版本：[`.claude/commands/pr-review.md`](../.claude/commands/pr-review.md)

### Step 4：處理 `.gitignore`

很多專案會把整個 `.claude/` 加入 `.gitignore`（因為 Claude Code 會在裡面放 symlink、本地設定等不可攜的內容）。但我們要讓 `.claude/commands/` 進 repo 共享。

修改 `.gitignore`：

```diff
- .claude/
+ .claude/*
+ !.claude/commands/
```

**為什麼是 `.claude/*` 而不是 `.claude/`：** Git 的 negation pattern (`!`) 對「被忽略的父目錄底下的子目錄」無效。寫成 `.claude/*` 只忽略「`.claude/` 底下的第一層內容」，這樣 negation 才能起作用。

### Step 5：Commit 並通知團隊

```bash
git checkout -b chore/add-pr-review-command
git add .gitignore .claude/commands/pr-review.md
git commit -m "chore: add /pr-review slash command for automated PR review"
git push -u origin chore/add-pr-review-command
gh pr create --title "chore: add /pr-review slash command for automated PR review" --body "..."
```

PR merge 後通知團隊安裝 `gh` 並開始使用。

## 進階：自訂審查規則

`pr-review.md` 是純文字 prompt，你可以根據團隊需求調整：

| 想做什麼 | 怎麼改 |
|---|---|
| 加入專案特定 convention | 在「審查面向」加一段引用 `CLAUDE.md` 或 `CONTRIBUTING.md` |
| 強制檢查測試覆蓋率 | 在「執行步驟」加 `gh pr checks` 之後跑 `pnpm test --coverage` 等 |
| 套用語言特定規則 | 用 conditional：「如果 diff 含 `.py`，套 PEP 8 檢查」 |
| 改成英文輸出 | 把整份文件翻成英文，包含級別名稱 |
| 加更多級別 | 在「審查面向」加更多 section（如 🟣 Security Hardening） |

## 限制與注意事項

### 限制

- **PR 大小**：超過約 1000 行 diff 時，context window 可能不足。建議拆小 PR 或先用 `Grep` 聚焦特定檔案。
- **單一 PR**：指令一次只審一個 PR。批次審查需另寫腳本。
- **無法跨 repo**：`gh` CLI 預設使用當前目錄的 git remote。要審其他 repo 的 PR 需先 `cd` 過去或用 `--repo owner/name`。
- **僅讀取 PR 當下狀態**：不會自動追蹤 PR 後續更新；新 commit 進來要重跑指令。

### 安全注意

- ❗ **不要把 `gh pr comment` / `gh pr review` 加進 `allowed-tools`**。本指令故意排除這兩個，讓寫入 GitHub 永遠需要當下確認。
- ❗ **不要在 unattended 環境執行**（CI、cron、background agent）。本工具設計為人類在場使用。
- ✅ 讀取操作（`gh pr view`、`gh pr diff`、`gh pr checks`）安全，可預先授權。

### 與 CI 的關係

本工具**不取代** CI。CI 跑自動化測試、build、靜態分析；`/pr-review` 跑人類視角的 code review。兩者互補，建議都有。

## 疑難排解

### 「unknown command /pr-review」

確認在正確 repo 根目錄打開 Claude Code，且 `.claude/commands/pr-review.md` 存在。Claude Code 啟動時掃描指令目錄，新增指令後可能需重啟對話。

### 「gh: command not found」

`gh` CLI 未安裝或不在 PATH。依 [Step 1](#step-1確認前置條件) 重新安裝。

### 「could not resolve to a PullRequest」

PR 編號錯誤、PR 已 close、或當前目錄的 git remote 不是該 PR 所在的 repo。檢查 `gh repo view` 確認當前對應的 repo。

### Review 報告品質不穩定

`pr-review.md` 是 prompt，prompt engineering 會影響輸出。建議：
- 把專案特定 convention 寫進去（不要依賴模型「猜」）
- 用真實 PR 多測幾次，根據實際輸出微調 prompt
- 對重要 PR 仍需人類最終決策

## 延伸閱讀

- [Claude Code 官方文件 - Slash Commands](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- 本 repo 的指令原始檔：[`.claude/commands/pr-review.md`](../.claude/commands/pr-review.md)
