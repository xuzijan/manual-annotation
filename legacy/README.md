此目录为迁移至 Next.js 之前保留的 **单机版** 入口：

- `server.js`：原生 Node HTTP 服务，读写 `data/progress.json`，从 `readable/` 读题。
- `index.html`：原标注页面。

新项目请使用仓库根目录的 `npm run dev`（Next.js）。若需临时运行旧版：`npm run legacy`。
