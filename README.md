# ARC V13 正式版｜搜尋中文輸入根因修正版

本版針對「篩選 / 查詢欄位中文輸入法無法選字」做根因修正。

## 找到的問題

原本搜尋欄位雖然有寫 compositionstart / compositionend，但 oninput 呼叫時只傳入 this，沒有傳入 event，所以程式無法讀到 event.isComposing。

在注音輸入組字期間，input 事件仍可能觸發 debounce 搜尋，接著 render() 會重建整個 app 內容，造成：

- 注音還沒選字就被固定
- 搜尋欄位被重新掛載
- 游標消失或失去焦點
- 手動輸入完整姓名時搜尋值停在半成品
- 手動輸入完整名稱與複製貼上完整名稱結果不一致

## 本版修正

- 全系統搜尋 oninput / composition 事件改為傳入 event。
- 使用 event.isComposing 與 inputType=insertCompositionText 判斷中文組字狀態。
- 組字期間不執行搜尋、不 render、不重建 input。
- render() 加上防護：只要任何搜尋欄位仍在 composition 中，就暫停整頁重繪，等 compositionend 後再執行。
- inputText 與實際 searchKeyword 繼續分離。
- 搜尋比對保留標準化處理：去除前後空白、換行、tab、零寬字元、全形半形統一、英文大小寫不敏感。
- 完整姓名、部分姓名、複製貼上完整名稱皆可一致查詢。

## 套用方式

解壓縮後，將資料夾內檔案放到 GitHub 專案第一層，確認第一層可看到：

- index.html
- package.json
- package-lock.json
- README.md
- 部署步驟.md
- supabase/

執行：

```bash
git add .
git commit -m "fix ARC V13 search IME composition root cause"
git push origin main
```

本次為前端搜尋輸入修正，不需要重新執行 Supabase SQL。
