# ARC 居留證控管系統｜V13 完全重製版

這份專案是依 `arc_style_preview_v13.html` 重新製作，保留 V13 原始內容、呈現方式、樣式、操作規則與 icon。

## 內容

- `index.html`：V13 原始單檔版面，包含 CSS、JS、Demo 資料與 icon。
- `package.json`：讓 GitHub / Vercel 可用 Vite 部署。

## 注意

這版為了保證與 V13 完全一致，仍採用 V13 原本的瀏覽器暫存 `localStorage` 資料邏輯。
確認外觀與流程完全正確後，再進行下一階段 Supabase 資料庫串接。

## 本機測試

```bash
pnpm install
pnpm run dev
```

或使用 npm：

```bash
npm install
npm run dev
```

## Vercel 設定

Framework Preset：Vite
Build Command：pnpm run build
Output Directory：dist
Install Command：pnpm install --frozen-lockfile=false
Root Directory：./
