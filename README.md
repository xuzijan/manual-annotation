# IAA 标注问卷

## 第一步：阅读标注指南

请先完整阅读 **[人工标注指南.md](Manual annotation guidelines.md)**，了解 8 类歧义标签的定义与使用规则，再进行答题。

## 第二步：本地运行（Next.js + Clerk）

本项目已迁移为 **Next.js（App Router）**，需要 **Clerk** 登录；进度可存 **MongoDB Atlas** 或本地文件（见下文）。

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量

**必须**在项目根目录新建 **`.env.local`**（可直接复制 `.env.example` 再改名），并把 Clerk 密钥填进去。**Next.js 不会读取 `.env.example` 作为运行配置**——若只有 `.env.example` 而没有 `.env.local`，本地会没有 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`，登录页会与 Dashboard 不一致。

填写内容：

- **Clerk**：在 [Clerk Dashboard](https://dashboard.clerk.com/) 创建应用，在 **API Keys** 中复制 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 与 `CLERK_SECRET_KEY`（并在 Dashboard 中启用 **GitHub** 等登录方式）。建议同时复制 `.env.example` 里 **以 `NEXT_PUBLIC_CLERK_SIGN_` 开头** 的几行，这样登录成功后会回到本站首页（标注页），而不是停在 Clerk 托管域名上。
- **MongoDB Atlas（建议）**：在 [Atlas](https://cloud.mongodb.com/) 复制 **`mongodb+srv://...`** 连接串，填入 **`MONGODB_URI`**；数据库名默认 **`iaa_quiz`**（集合 **`progress`**）。**Network Access** 需包含 **`0.0.0.0/0`**（便于本机与 Vercel）。  
  未配置时，本地会将进度写入 **`data/clerk-progress.json`**。配置后请 **重启 `npm run dev`**，并访问 **http://localhost:3000/api/debug/mongo**（仅开发环境）应返回 `"ok": true`。

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器访问：**http://localhost:3000**（未登录会跳转到 Clerk 登录页）。

### 4. 答题流程

进入第一题前，会先进入「信息统计」页：填写问卷回答者英文名称，并选择要做的数据集编号（1-20），再按提示完成标注。

## 旧版单机脚本（仅供参考）

原先的 `server.js` + `index.html` 已移至 **`legacy/`** 目录。如需本地无登录运行旧版，可执行：

```bash
npm run legacy
```

## 第三步：提交答案

- 若使用 **MongoDB**：请在 Atlas 中导出或由管理员从 `iaa_quiz` 数据库中的 `progress` 集合备份。
- 若使用 **本地文件**：请提交 **`data/clerk-progress.json`**（多用户进度汇总）。
- 若仍使用旧版 `legacy` 且仅写 `data/progress.json`，则提交该文件。

更多部署说明见 **[部署与上线指南.md](部署与上线指南.md)**。
