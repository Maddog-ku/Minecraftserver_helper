# Minecraft Server Helper (Electron + Vite + Vue 3 + TS)

這是一個可直接執行的 Windows 桌面 App，提供 Minecraft 多伺服器管理、啟動與 Mods 管理等功能，並採用安全的 Electron 設定：
- `nodeIntegration: false`
- `contextIsolation: true`
- 透過 `preload` 暴露 `window.api` 白名單

## 功能概覽
- 多伺服器 Registry：新增 / 刪除 / 改名 / 清單
- 伺服器啟動 / 停止、Console log 串流、指令輸入
- Java runtime 自動下載（Temurin 21，僅首次，存放於 app userData/runtime）
- Mods 管理：匯入 `.jar` / `.zip`、CurseForge modpack（overrides）、資料夾匯入、啟用/停用/移除
- UI：Sidebar（伺服器列表 + 搜尋 + 右鍵選單）/ ServerDetail（Info、Console、Mods）

## 專案結構
```
app/
  electron/
    main.ts
    preload.ts
    domain/
      ServerProfile.ts
    ipc/
      serverIpc.ts
      modsIpc.ts
      runtimeIpc.ts
    services/
      serverRuntimeService.ts
      modsService.ts
      javaRuntimeService.ts
    storage/
      paths.ts
      registryStore.ts
    utils/
      window.ts
  renderer/
    index.html
    vite.config.ts
    tsconfig.json
    src/
      main.ts
      App.vue
      components/
        SidebarServers.vue
        ConsolePanel.vue
        ModsPanel.vue
        RuntimeDownloadModal.vue
      pages/
        Home.vue
        ServerDetail.vue
        CreateWizard.vue
      store/
        serversStore.ts
      api/
        client.ts
      constants/
        coreTypes.ts
```

## 開發與建置
1) 安裝依賴
```
npm install
```

2) 開發模式（Vite + Electron）
```
npm run electron:dev
```
- Vite dev server: `http://localhost:5173`
- Electron 會載入 dev server

3) 生產建置
```
npm run build
```

4) 打包 Windows NSIS
```
npm run dist
```

其他常用 scripts：
```
npm run dev
npm run build:renderer
npm run build:electron
```

## 資料與路徑
- Registry：`app.getPath('userData')/registry.json`
- 伺服器資料夾：`Documents/<AppName>/Servers/<serverId>/server/`
- Mods：`<serverDir>/mods/`
- 內建 Java runtime：
  - `app.getPath('userData')/runtime/java-21/`
  - `app.getPath('userData')/runtime/cache/`

## 安全規範
Renderer 端禁止直接使用 `fs/path/child_process`，只能透過 `preload.ts` 暴露的 `window.api`：
```ts
// app/electron/preload.ts
contextBridge.exposeInMainWorld('api', {
  // safe methods
});
```

## 備註
- 預設 target 為 Windows（`electron-builder` NSIS），可在其他平台開發但路徑行為以 Windows 為主。
- 初次啟動伺服器若未有 runtime，會自動下載 Temurin 21 並顯示進度。
