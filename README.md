# ARC V13 正式版｜左側選單按鈕修正版

本版修正左側選單多個按鈕點選後沒有反應的問題。

## 修正內容

- 左側選單點選頁面時，會強制清除殘留的中文輸入法 composition 鎖定狀態。
- 左側選單切換頁面改為 `render(true)`，不再被搜尋輸入框的暫停 render 機制擋住。
- `isAnySearchComposing()` 改為只判斷目前焦點中的 input 是否正在組字，避免已被移除或殘留的搜尋框狀態卡住整個系統。
- 左側選單 button 補上 `type="button"`，避免被表單語意誤判。
- 保留上一版中文搜尋修正，不影響注音選字。

## 套用方式

解壓縮後，把檔案放到 GitHub 專案第一層，執行：

```bash
git add .
git commit -m "fix ARC V13 left menu buttons after IME search fix"
git push origin main
```

這次不用重新跑 Supabase SQL。
