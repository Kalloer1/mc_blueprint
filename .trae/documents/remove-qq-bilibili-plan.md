# 删除 QQ 和 B站 登录代码计划

## 任务概述

只保留 GitHub 登录，删除 QQ 和 B站 登录相关代码。

---

## 文件修改清单

### 1. worker-upload.js

**删除内容**：

| 位置 | 删除项 | 说明 |
|------|--------|------|
| 配置区 | B站 OAuth 配置 | `BILIBILI_CLIENT_ID`, `BILIBILI_CLIENT_SECRET`, `BILIBILI_REDIRECT_URI` |
| 配置区 | QQ OAuth 配置 | `QQ_APP_ID`, `QQ_APP_KEY`, `QQ_REDIRECT_URI` |
| 路由区 | `/callback` 端点 | QQ OAuth 回调 |
| 路由区 | `/auth/bilibili` 端点 | B站 OAuth 授权跳转 |
| 路由区 | `/auth/bilibili/callback` 端点 | B站 OAuth 回调 |
| 函数区 | `handleQQCallback` | QQ OAuth 回调处理函数 |
| 函数区 | `handleBilibiliAuth` | B站 OAuth 授权跳转函数 |
| 函数区 | `handleBilibiliCallback` | B站 OAuth 回调处理函数 |

**保留内容**：
- GitHub OAuth 配置和端点
- 蓝图上传、审核等核心功能
- OpenList 存储支持

---

### 2. js/auth.js

**删除内容**：

| 位置 | 删除项 | 说明 |
|------|--------|------|
| 配置区 | B站 OAuth 配置 | `BILIBILI_CLIENT_ID` |
| 配置区 | QQ OAuth 配置 | `QQ_APP_ID`, `QQ_REDIRECT_URI`, `QQ_AUTH_URL` |
| 函数区 | `loginWithBilibili` | B站登录函数 |
| 函数区 | `loginWithQQ` | QQ 登录函数 |
| 回调处理 | QQ OAuth 回调逻辑 | `handleCallback` 中的 QQ 回调部分 |
| 登录按钮 | QQ 登录按钮代码 | 备用的 QQ 登录按钮 |

**保留内容**：
- GitHub OAuth 配置
- `loginWithGitHub` 函数
- GitHub 登录按钮
- Toast 提示、用户状态显示等通用功能

---

## 实施步骤

1. 编辑 `worker-upload.js`：
   - 删除 B站 和 QQ OAuth 配置
   - 删除路由端点
   - 删除处理函数

2. 编辑 `js/auth.js`：
   - 删除 B站 和 QQ OAuth 配置
   - 删除登录函数
   - 简化 `showLoginButton` 只显示 GitHub 登录按钮
   - 简化 `handleCallback` 只处理 GitHub 回调

---

## 验证步骤

1. 检查 worker-upload.js 只包含 GitHub OAuth
2. 检查 js/auth.js 只包含 GitHub 登录
3. 确认登录按钮显示为 "GitHub 登录"