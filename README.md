# 旅遊行程規劃工具 (Trip Planner)

一個**純前端、可離線使用**的旅遊行程規劃網頁應用，可免費部署到 **GitHub Pages**（`你的帳號.github.io`）。

## 功能特色

- 建立多日行程（名稱、目的地、起迄日期）
- 每日新增活動（時間、類型、地點、備註）+ 地圖標記
- **航班資訊**：去程 / 回程班機、行李重量限制
- **行李清單**：分類、勾選是否已打包、一鍵載入預設清單
- **費用支出**：分類（吃飯/伴手禮/交通/代買等）、金額、幣別、是否可退稅
- **需購買清單**：分類、數量、購買人、可上傳參考照片
- **交通資訊**：
  - 路線圖：可上傳多張路線圖，用可展開／收合卡片呈現
  - 時刻表查詢：可新增官方時刻表或 App 連結，同樣用可展開卡片呈現
- 資料自動儲存到瀏覽器 LocalStorage
- 匯出 JSON、列印
- 完全響應式，手機也能用
- **零後端、零資料庫、零 API Key**

## 線上預覽

部署後網址範例：`https://你的帳號.github.io/trip-planner/`

## 快速開始（本地測試）

1. 下載或 clone 本專案
2. 直接用瀏覽器開啟 `index.html` 即可（或使用 Live Server）

```bash
# 如果想用本地伺服器
npx serve .
```

## 部署到 GitHub Pages（完整教學）

### 方法一：最簡單（推薦新手）

1. **登入 GitHub** → 點右上角 `+` → **New repository**
2. Repository name 填：`trip-planner`（或任何你喜歡的名稱）
3. 設為 **Public**（免費 GitHub Pages 需要公開 repo）
4. 不要勾選「Add a README」（因為我們已有檔案）
5. 點 **Create repository**

6. 在剛建立的 repo 頁面，點 **uploading an existing file**
7. 把以下三個檔案拖進去：
   - `index.html`
   - `styles.css`
   - `app.js`
8. 在下方 Commit 訊息寫：`Initial commit` → 點 **Commit changes**

9. 進入 repo 的 **Settings** → 左側選 **Pages**
10. 在 **Source** 選擇 **Deploy from a branch**
11. Branch 選 `main`（或 `master`），資料夾選 `/ (root)` → 點 **Save**
12. 等 1～2 分鐘，重新整理頁面，會出現網址：
    ```
    https://你的帳號.github.io/trip-planner/
    ```

完成！把這個網址分享給朋友就能用了。

---

### 方法二：使用 Git 指令（適合有開發經驗）

```bash
# 1. 在本機建立資料夾並進入
mkdir trip-planner && cd trip-planner

# 2. 把 index.html、styles.css、app.js 放進來

# 3. 初始化 git
git init
git add .
git commit -m "Initial commit: Trip Planner"

# 4. 在 GitHub 建立空的 public repo（名稱建議 trip-planner）

# 5. 連接遠端並推送
git branch -M main
git remote add origin https://github.com/你的帳號/trip-planner.git
git push -u origin main
```

然後到 GitHub repo → **Settings** → **Pages** → Source 選 `main` / root → Save。

---

### 方法三：部署到使用者首頁（username.github.io）

如果你想讓網址變成 `https://你的帳號.github.io`（沒有子路徑）：

1. 建立一個名稱**剛好是** `你的帳號.github.io` 的 repository
2. 把三個檔案推到這個 repo 的 `main` 分支根目錄
3. 到 Settings → Pages 啟用即可

---

## 進階小技巧

### 自訂網域
在 Pages 設定頁可以綁定自己的網域（需先在 DNS 設定 CNAME）。

### 更新內容
之後只要修改檔案再 commit + push，GitHub Pages 會自動重新部署（通常 30 秒～2 分鐘）。

### 資料安全
所有行程資料都存在使用者自己的瀏覽器 LocalStorage，**不會上傳到任何伺服器**。清除瀏覽器資料會導致行程遺失，建議定期用「匯出」功能備份。

## 技術棧

- 純 HTML + CSS + Vanilla JavaScript
- Tailwind CSS（CDN）
- Leaflet.js + OpenStreetMap
- Nominatim（地理編碼，無需 API Key）

## License

MIT – 自由使用、修改、分享。
