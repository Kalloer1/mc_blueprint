# MC蓝图工坊 网站改进计划

## 对比分析

| 方面 | 当前网站 (MC蓝图工坊) | 参考网站 (Reden) | 差距 |
|------|----------------------|-------------------|------|
| 技术栈 | 原生 HTML/CSS/JS 静态站 | Nuxt 3 + Vue 3 + TypeScript SSR | 大 |
| 登录 | GitHub OAuth（有 bug） | 邮箱+密码注册/登录 + OAuth | 需修复 |
| 蓝图预览 | 占位图（URL 无效） | 3D WASM 渲染器实时预览 | 缺失 |
| 用户管理 | 无（仅 localStorage） | 完整用户系统（注册/登录/资料/权限） | 缺失 |
| 安全 | 密钥明文硬编码在代码中 | 服务端环境变量存储 | 严重漏洞 |
| 审核 | 有审核页面但无后端数据 | 完整管理员后台 | 基本可用 |

---

## 问题清单

### 1. GitHub 登录 bug（bad_verification_code）

**根因分析**：
- `loginWithGitHub()` 跳转至 GitHub 授权页，包含 `redirect_uri`
- GitHub 授权后重定向到 Worker 的 `/auth/github/callback`
- Worker 用 code 换 token 时，`redirect_uri` 必须与授权时完全一致
- 当前 `GITHUB_REDIRECT_URI` 硬编码在 Worker 中，但 `loginWithGitHub` 中用的是 `AUTH_WORKER_URL + '/auth/github/callback'`
- 需要确认 GitHub OAuth App 设置中回调 URL 是否完全匹配

**修复方案**：
- 确保 Worker 的 `GITHUB_REDIRECT_URI` 与 GitHub OAuth App 后台设置完全一致
- 添加调试日志，输出 code 交换的完整请求和响应
- 防止 code 被重复使用（添加一次性标记）

### 2. 蓝图预览功能缺失

**当前状态**：预览图 URL 指向不存在的 API（`https://api.mcschematic.top/...`）

**修复方案**（按优先级）：
1. **短期**：使用 Minecraft 生成式 AI 图片作为占位图（通过 `text_to_image` API 生成）
2. **中期**：搭建简单的蓝图预览图生成服务（参考 Reden 的 LitematicaPreview）
3. **长期**：集成 WASM 3D 渲染器（需要后端支持）

### 3. 用户数据管理缺失

**当前状态**：仅 localStorage 存储用户信息，无服务端用户管理

**修复方案**：
- 在 Worker 中添加用户数据 KV 存储
- 添加 `/api/user/profile` 接口（获取/更新用户信息）
- 添加 `/api/user/blueprints` 接口（用户上传的蓝图列表）
- 前端添加用户个人中心页面 `/profile.html`

### 4. 安全漏洞

**严重漏洞**：
- `GITHUB_APP_SECRET` 明文硬编码在 `worker-upload.js` 中
- `ADMIN_PASSWORD` 明文硬编码
- `OPENLIST_TOKEN` 明文硬编码
- 这些密钥会随代码推送到公开的 GitHub 仓库

**修复方案**：
- 使用 Cloudflare Workers **Secrets** 存储敏感信息
- 删除代码中的密钥硬编码，改用 `env.SECRET_NAME`
- 立即撤销已在 GitHub 公开的 GitHub App Secret

### 5. 其他问题

| 问题 | 说明 |
|------|------|
| 响应式设计 | Reden 使用 Vuetify 响应式框架，当前网站缺少移动端适配 |
| 搜索功能 | 仅有前端文本过滤，无模糊搜索 |
| 蓝图分页 | 数据多时无分页加载 |
| 文件存储 | OpenList URL 已配置但可能未验证可用性 |

---

## 修改文件清单

### 文件 1：worker-upload.js（高优先级）

**修改内容**：
1. **修复 GitHub 登录**：使用请求 URL 动态构建 redirect_uri，而非硬编码
2. **移除硬编码密钥**：`GITHUB_APP_SECRET`、`ADMIN_PASSWORD` 改为从环境变量读取
3. **添加用户数据接口**：`/api/user/profile`、`/api/user/blueprints`
4. **添加调试日志**：在 callback 处理中添加详细日志

### 文件 2：js/auth.js（高优先级）

**修改内容**：
1. 确保 `redirect_uri` 与 Worker 端完全一致
2. 移除硬编码的 `GITHUB_APP_ID` 公开信息（可保留，非敏感）
3. 添加登录失败的错误详细信息展示

### 文件 3：blueprints/data.json（中优先级）

**修改内容**：
1. 将无效的预览图 URL 替换为可用的占位图
2. 使用 `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image` 生成 Minecraft 风格图片

### 文件 4：新建 profile.html（中优先级）

**内容**：用户个人中心页面
- 显示用户信息（头像、昵称、GitHub 主页链接）
- 显示用户上传的蓝图列表
- 编辑个人资料（可选）

### 文件 5：新建 css/profile.css（中优先级）

**内容**：个人中心页面样式

### 文件 6：js/gallery.js（低优先级）

**修改内容**：
1. 添加加载更多/分页功能
2. 添加模糊搜索支持

---

## 实施步骤

### 第一步：修复安全漏洞（立即执行）

1. 将 `GITHUB_APP_SECRET` 改为 Worker Secret
2. 将 `ADMIN_PASSWORD` 改为 Worker Secret
3. 将 `OPENLIST_TOKEN` 改从环境变量读取
4. 在 GitHub 后台撤销已泄露的 Client Secret，生成新的

### 第二步：修复 GitHub 登录

1. 修改 Worker 的 `handleGitHubCallback`，动态获取 redirect_uri
2. 确保前端和后端的 redirect_uri 完全一致
3. 部署测试

### 第三步：添加用户数据管理

1. 在 Worker 中添加用户相关 API
2. 创建用户个人中心页面
3. 在导航栏添加用户中心入口

### 第四步：蓝图预览优化

1. 生成占位预览图
2. 更新 data.json

### 第五步：其他优化

1. 添加分页功能
2. 改进搜索

---

## 验证步骤

1. 测试 GitHub 登录：点击登录按钮 → 授权 → 返回首页显示用户信息
2. 检查 Worker 代码中无明文密钥
3. 访问个人中心页面，查看用户信息
4. 检查蓝图预览图是否正常显示
5. 测试审核页面功能