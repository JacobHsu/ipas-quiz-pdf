---
description: Review a GitHub PR using gh CLI with tiered severity report
argument-hint: <PR_NUMBER>
allowed-tools: Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Bash(gh pr comment:*), Bash(gh pr review:*), Read, Grep
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
- 標註檔名:行號（用 markdown 連結格式 `[file.ext:N](file.ext#LN)`）
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
- 違反專案既有 convention（參考 CLAUDE.md）
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

最後一行給出結論之一：
- ✅ **Approve** — 沒有 Critical/High，可直接 merge
- 🔧 **Approve with suggestions** — 有 Medium 建議但不擋 merge
- ❌ **Request changes** — 有 Critical 或 High，需修正後再 review

## 詢問是否貼回 PR

報告完成後，問使用者：

> 要把這份 review 貼回 PR 嗎？
> - **A** · `gh pr comment $1 --body-file <tmp>` — 一般 comment
> - **B** · `gh pr review $1 --comment --body-file <tmp>` — 正式 review（顯示在 Files changed tab）
> - **C** · 不貼，只在本地看

依使用者回應決定是否執行貼回動作。**不要自動貼**。

## 注意

- 遵守專案 [CLAUDE.md](CLAUDE.md) 的 12 條規則，特別是 Rule 3（surgical changes）和 Rule 11（match codebase conventions）
- 如果 repo 已有 CodeRabbit 或其他 bot review，提一句並補充 bot 常忽略的角度（a11y、i18n、UX、業務邏輯）
- 不要重複 bot 已經抓到的點
