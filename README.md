# ARC 居留證送件繳費領件控管系統｜Supabase / GitHub / Vercel 正式版 V1

這版改成你習慣的正式架構：

- 前端：React + Vite
- 資料庫：Supabase PostgreSQL
- 版本控管：GitHub
- 部署：Vercel

## 已包含功能

- 本機使用者鎖定：第一次選擇後鎖定，下次自動沿用；更換需管理員解除碼。
- 單筆送件、批次送件、單筆現場送件。
- 現場送件直接進待領件，不進繳費。
- 選案繳費、同批繳費明細、手續費預設 7 元可修改。
- 初辦居留證、初辦居留證(紙本)、報備不製證：繳費後顯示「請至移民署線上下載居留證」，不進傳真與簽收單。
- 會計對帳、會計查詢、財務確認後扣除帳戶餘額。
- 傳真與領件：一鍵全選 / 取消、補 KEY、總張數、列印傳真表與簽收單。
- 傳真排序：收費日期 → 收件編號 → 右上角外字末五碼。
- 簽收單排序：承辦 → 雇主；簽名欄依承辦顯示張數。
- 案件查詢、統計數據、匯出 CSV。
- 仲介別可新增，扣款帳號可新增 / 刪除 / 複製 / 修改餘額。
- 承辦、申請項目、系統設定可維護。
- 移民署服務站、專勤隊聯絡資訊頁面。
- 操作紀錄：新增、修改、作廢、財務確認、切換使用者等。

## Supabase 設定

1. 到 Supabase 建立新專案。
2. 打開 SQL Editor。
3. 依序執行：

```sql
supabase/001_schema.sql
supabase/002_seed_data.sql
```

4. 到 Supabase Project Settings → API，複製：

- Project URL
- anon public key

## 本機測試

建立 `.env.local`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

安裝與啟動：

```bash
npm install
npm run dev
```

打開：

```text
http://localhost:5173
```

## GitHub / Vercel 部署

```bash
git init
git add .
git commit -m "ARC residence control supabase v1"
git branch -M main
git remote add origin https://github.com/你的帳號/arc-residence-control.git
git push -u origin main
```

到 Vercel 匯入 GitHub 專案，並設定環境變數：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Build Command：

```bash
npm run build
```

Output Directory：

```text
dist
```

## 預設資料

仲介：

- 灃康 FW
- 乾坤 WC
- 灃禾 FC

預設管理員解除碼：

```text
2468
```

正式使用前請到「系統設定」修改。

## 注意

這版是免帳號密碼登入，因此 Supabase RLS policy 目前設定為 anon 可讀寫，適合內部控管網址使用。若未來要做更嚴格權限，例如主管、會計、行政分權，建議再改成 Supabase Auth 或 Vercel API 代理寫入。
