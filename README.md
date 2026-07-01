# ARC 居留證控管系統｜V13 正式版（Supabase 共享資料）

本版以 Demo V13 的內容、呈現方式、樣式、規則與 icon 為基準，改成正式版架構：

- Email 登入
- 角色權限
- 帳號後台：新增、修改密碼、停用、刪除
- 帳號綁定個人
- 會計可修改帳戶餘額
- 操作紀錄
- 軟刪除與資料救回
- Supabase 共享資料，不再只存在單一電腦瀏覽器
- Vercel 部署

## 權限

| 角色 | 權限 |
|---|---|
| 管理員 | 全部權限 |
| 行政 | 送件、選案繳費、傳真領件、案件查詢、統計、匯出、聯絡資訊、操作紀錄 |
| 會計 | 會計對帳、會計查詢、修改帳戶餘額 |

行政與會計不可刪除繳費批次；刪除批次僅管理員可操作。

## 重要功能規則

### 編號規則

| 類型 | 規則 | 範例 |
|---|---|---|
| 案件編號 | ARC + 仲介代碼 + 西元年月日 + 三碼流水號 | ARCFW20260630001 |
| 批次編號 | 仲介代碼 + 西元年月日 + 三碼流水號 | FW20260630001 |

### 選案繳費

- 待繳案件依仲介分開顯示。
- 不同仲介不可同一批繳費。
- 可搜尋雇主、工人名、團號、案件編號。
- 有團號欄位。
- 案件量多時可在固定高度區塊內滑動查看。
- 有一鍵勾選、一鍵取消。
- 已登入送件案件可在選案繳費頁取消繳費，需填取消原因。
- 取消繳費案件保留紀錄，不進待繳、不進待領，金額不計入統計。
- 統計頁會列在取消案件。

### 傳真與領件

- 不同仲介可以一起傳真與領件。
- 列印使用 A4 直式。
- 傳真與簽收單只列印指定區塊，不列印整個系統頁面。

### 申請項目

預設申請明細：

- 新入境初次（紙本）
- 新入境展延（卡式）
- 續聘展延
- 承接展延
- 換護照展延
- 報備不製證
- 遺失補發
- 資料異動
- 中階居留證
- 雙語居留證
- 取消申請

管理員可在系統設定調整申請項目。

## 預設帳號

密碼統一：`123456`

| 姓名 | 角色 | Email |
|---|---|---|
| 若儀 | 管理員 | jillzoe@forwardhrm.com.tw |
| 嘉陽 | 管理員 | patty@forwardhrm.com.tw |
| 明書 | 管理員 | mint@forwardhrm.com.tw |
| 詩涵 | 行政 | rachel@forwardhrm.com.tw |
| 佩珊 | 行政 | penny@forwardhrm.com.tw |
| 晏婷 | 行政 | helen@forwardhrm.com.tw |
| 奕君 | 行政 | jean_guo@forwardhrm.com.tw |
| 莞莞 | 行政 | maru@forwardhrm.com.tw |
| 芸瑄 | 會計 | nina@forwardhrm.com.tw |
| 淑娥 | 會計 | joy@forwardhrm.com.tw |

## 正式版資料儲存方式

本正式版使用 Supabase RPC 儲存整份系統資料狀態。

- 瀏覽器 localStorage 只作為操作中的暫存備份。
- 必須設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY` 才能登入正式版。
- 帳號密碼存在 Supabase 資料表，使用 `pgcrypto` 雜湊，不會以明碼寫入前端檔案。

## 部署順序

1. 在 Supabase SQL Editor 執行 `supabase/001_formal_schema_rpc.sql`。
2. 在 Vercel 設定環境變數：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 推上 GitHub。
4. Vercel 自動部署。
5. 第一次登入後，系統會把 V13 預設資料同步到 Supabase。


## 登入修正

若登入時出現：`function crypt(text, text) does not exist`，請到 Supabase SQL Editor 執行：

```text
supabase/002_fix_pgcrypto_login_and_hide_login_hint.sql
```

原因是 pgcrypto 的 `crypt` / `gen_salt` 在 Supabase 可能位於 `extensions` schema，正式 RPC 已調整 search_path。

## 登入畫面

登入按鈕下方的預設帳號提示文字已移除。
