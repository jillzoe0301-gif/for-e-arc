# ARC V13 正式版｜中文搜尋、完整姓名查找與系統設定修正版

本版依第二十三項需求修正正式版阻斷問題，重點為全系統搜尋 / 查詢 / 查找 / 篩選中文輸入、完整姓名查找、系統設定項目恢復，以及 `renderUserManagement is not defined` 錯誤。

## 本版修正重點

- 全系統搜尋輸入支援中文注音 composition：組字中不執行搜尋、不重設 input、不重新固定文字。
- 搜尋輸入狀態與實際搜尋狀態分離：輸入中暫存，compositionend 或 debounce 後才套用查詢。
- 搜尋結果更新後會保留輸入框焦點與游標，避免輸入中文時跳掉或清空。
- 搜尋比對統一標準化：trim、移除 tab / 換行 / 不可見字元 / 零寬字元、全形半形統一、大小寫不敏感、連續空白合併。
- 中文姓名中間空白不影響比對，完整姓名與部分姓名皆可查找。
- 手動輸入完整名稱與複製貼上完整名稱搜尋結果一致。
- 修正 `renderUserManagement is not defined`，恢復帳號設定頁面。
- 系統設定恢復管理員可維護項目：帳號設定、人員選項設定、送件項目設定、手續費設定、仲介公司設定、帳戶設定、傳真 / 領件設定、提醒事項設定、列印設定。
- 系統設定以可點選切換方式呈現，不使用總覽頁。
- 管理員可新增、修改、停用、刪除設定資料；非管理員不可修改。
- 行政仍不可調整帳戶餘額。
- 系統設定異動會寫入操作紀錄。

## 套用方式

解壓縮後，將資料夾內檔案放到 GitHub 專案第一層，確認第一層可看到：

- index.html
- package.json
- package-lock.json
- README.md
- 部署步驟.md
- .env.example
- supabase/

執行：

```bash
git add .
git commit -m "fix ARC V13 Chinese search and settings management"
git push origin main
```

本次為前端功能修正，不需要重新執行 Supabase SQL。
