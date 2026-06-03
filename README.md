# 自主學習系統

一個雲端優先（cloud-first）的自主學習 Web App。使用者登入後，可透過左側側邊欄切換不同功能，包含考試成績、雲端筆記本、個人化設定、蕃茄鐘、自訂日曆與 NVIDIA NIM AI 導師。

## 功能

- **側邊欄功能導覽**：所有主要工具都集中在左側側邊欄，方便使用者快速切換。
- **雲端身份與資料**：透過 Firebase Authentication 與 Firestore REST API 讀寫資料；應用程式不使用 `localStorage` 保存使用者資料。
- **考試成績與備註**：記錄科目、日期、分數與檢討備註，並計算總覽平均分數。
- **雲端筆記本**：新增、同步與刪除學習筆記。
- **個人化設定**：支援深色/淺色模式、喜好顏色、字體大小、字形與 NVIDIA NIM 設定。
- **蕃茄鐘**：提供 25 分鐘專注與 5 分鐘休息模式切換。
- **規劃日曆**：讓使用者自行建立複習、作業、考試與專題規劃。
- **AI 導師**：呼叫 NVIDIA NIM Chat Completions 相容端點，並帶入近期成績、筆記與日曆作為學習脈絡。

## 快速開始

1. 安裝依賴：

   ```bash
   npm install
   ```

   > 目前專案不需要第三方執行期依賴；此步驟主要用於標準 npm 工作流程。

2. 建立瀏覽器端雲端設定：

   ```bash
   cp config.example.js config.js
   ```

3. 在 `config.js` 填入 Firebase Web API Key 與 Project ID：

   ```js
   window.LEARNING_CLOUD_CONFIG = {
     apiKey: "your-firebase-web-api-key",
     projectId: "your-firebase-project-id",
   };
   ```

4. 啟動開發伺服器：

   ```bash
   npm start
   ```

## 雲端資料路徑

登入後的資料會寫入下列 Firestore 文件路徑：

- `users/{uid}/exams/{examId}`
- `users/{uid}/notes/{noteId}`
- `users/{uid}/events/{eventId}`
- `users/{uid}/profile/settings`

> 生產環境建議搭配 Firestore Security Rules 限制使用者只能存取自己的 `users/{uid}` 文件樹。

## NVIDIA NIM 設定

AI 導師預設使用 NVIDIA NIM Chat Completions 相容格式：

- Endpoint：`https://integrate.api.nvidia.com/v1/chat/completions`
- Model：`meta/llama-3.1-70b-instruct`

使用者可在「個人化設定」中調整 Endpoint、模型與 API Key。正式部署時建議改由後端代理或雲端函式保存 NIM API Key，避免在瀏覽器中暴露敏感金鑰。

## 檢查與建置

```bash
npm run check
npm run build
```
