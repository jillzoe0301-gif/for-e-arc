# ARC V13 正式版｜搜尋查找與中文輸入最終修正版

本版修正全系統搜尋 / 查詢 / 查找 / 篩選欄位：

- 中文注音 compositionstart / compositionupdate 期間不搜尋、不重建 input。
- compositionend 後立即解除 isComposing，並用最終選字值搜尋。
- 英文、數字、已完成中文輸入 debounce 後正常搜尋。
- blur、Enter、paste、清除搜尋會解除 composition 鎖定。
- 搜尋只更新結果區，不呼叫整頁 render，不重建包含 input 的父層。
- 財務查詢維持預設顯示全部資料，不再以起始日期 / 結束日期限制；可用繳費月份篩選。
- 版面與表格維持依畫面寬度顯示。
套用後不需要重新執行 Supabase SQL。
