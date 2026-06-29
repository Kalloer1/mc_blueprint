/**
 * 多平台 OAuth 登录集成模块
 * 支持：GitHub、B站、QQ（备用）
 */

// ==================== 配置常量 ====================

// Cloudflare Worker 地址
const AUTH_WORKER_URL = 'https://qq-auth.wqclo.workers.dev';

// GitHub OAuth 配置（如果已配置）
const GITHUB_APP_ID = ''; // 替换为你的 GitHub OAuth App ID

// B站 OAuth 配置（如果已配置）
const BILIBILI_CLIENT_ID = ''; // 替换为你的 B站 Client ID

// QQ OAuth 配置（备用）
const QQ_APP_ID = '1112518560';
const QQ_REDIRECT_URI = (function () {
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/[^/]*$/, '') + 'auth/callback.html';
  return origin + path;
})();
const QQ_AUTH_URL = 'https://graph.qq.com/oauth2.0/authorize';

// ==================== 工具函数 ====================

/**
 * 生成随机 state 字符串，用于 CSRF 防护
 */
function generateState() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 显示 Toast 提示消息
 */
function showToast(message, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      padding: 12px 24px;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
      pointer-events: none;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = type === 'error' ? 'toast toast-error' : 'toast toast-success';

  if (type === 'error') {
    toast.style.background = '#e74c3c';
  } else {
    toast.style.background = '#27ae60';
  }

  requestAnimationFrame(function () {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(function () {
      toast.className = '';
    }, 300);
  }, 3000);
}

// ==================== GitHub 登录 ====================

function loginWithGitHub() {
  if (!GITHUB_APP_ID) {
    showToast('GitHub 登录暂未配置', 'error');
    return;
  }

  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_platform', 'github');

  const redirectUri = AUTH_WORKER_URL + '/auth/github/callback';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;

  window.location.href = authUrl;
}

// ==================== B站 登录 ====================

function loginWithBilibili() {
  if (!BILIBILI_CLIENT_ID) {
    showToast('B站登录暂未配置', 'error');
    return;
  }

  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_platform', 'bilibili');

  const gourl = encodeURIComponent(window.location.origin + '/auth/callback.html');
  const authUrl = `https://account.bilibili.com/pc/account-pc/auth/oauth?client_id=${BILIBILI_CLIENT_ID}&gourl=${gourl}&state=${state}`;

  window.location.href = authUrl;
}

// ==================== QQ 登录（备用） ====================

function loginWithQQ() {
  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_platform', 'qq');

  const authUrl = QQ_AUTH_URL
    + '?response_type=code'
    + '&client_id=' + QQ_APP_ID
    + '&redirect_uri=' + encodeURIComponent(QQ_REDIRECT_URI)
    + '&state=' + state;

  window.location.href = authUrl;
}

// ==================== 登录按钮 ====================

function showLoginButton() {
  var navUser = document.getElementById('nav-user');
  if (!navUser) return;

  navUser.innerHTML = '';

  // 创建登录按钮容器
  var container = document.createElement('div');
  container.className = 'login-buttons';
  container.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  // GitHub 登录按钮
  if (GITHUB_APP_ID) {
    var githubBtn = document.createElement('a');
    githubBtn.className = 'btn-login btn-github';
    githubBtn.href = 'javascript:void(0)';
    githubBtn.title = '使用 GitHub 账号登录';
    githubBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub';
  githubBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #24292e; color: #fff; border-radius: 6px; font-size: 13px; text-decoration: none; transition: background 0.2s;';
  githubBtn.addEventListener('mouseenter', function() { this.style.background = '#373e47'; });
  githubBtn.addEventListener('mouseleave', function() { this.style.background = '#24292e'; });
  githubBtn.addEventListener('click', loginWithGitHub);
  container.appendChild(githubBtn);
  navUser.appendChild(container);
  return;
  }

  // 如果没有 GitHub App ID，显示 QQ 按钮
  var btn = document.createElement('a');
  btn.className = 'btn-login';
  btn.href = 'javascript:void(0)';
  btn.title = '使用 QQ 账号登录';

  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.verticalAlign = 'middle';
  svg.style.marginRight = '6px';

  var circle = document.createElementNS(svgNS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '11');
  circle.setAttribute('fill', '#12B7F5');

  var text = document.createElementNS(svgNS, 'text');
  text.setAttribute('x', '12');
  text.setAttribute('y', '16.5');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', '#fff');
  text.setAttribute('font-size', '14');
  text.setAttribute('font-weight', 'bold');
  text.textContent = 'Q';

  svg.appendChild(circle);
  svg.appendChild(text);
  btn.appendChild(svg);
  btn.appendChild(document.createTextNode('QQ 登录'));

  btn.addEventListener('click', loginWithQQ);
  container.appendChild(btn);
  navUser.appendChild(container);
}

// ==================== 用户状态显示 ====================

function updateNavUser(user) {
  var navUser = document.getElementById('nav-user');
  if (!navUser || !user) return;

  navUser.innerHTML = '';

  // 头像
  var avatar = document.createElement('img');
  avatar.className = 'user-avatar';
  avatar.src = user.avatar || user.figureurl_qq_2 || user.figureurl_qq_1 || user.figureurl || '';
  avatar.alt = user.nickname || '用户头像';
  avatar.title = user.nickname || '';
  avatar.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 6px; border: 2px solid rgba(255,255,255,0.3);';

  // 用户名
  var name = document.createElement('span');
  name.className = 'user-name';
  name.textContent = user.nickname || (user.platform ? user.platform + '用户' : '用户');
  name.style.cssText = 'vertical-align: middle; margin-right: 8px; font-size: 14px; color: #333;';

  // 退出按钮
  var logoutBtn = document.createElement('a');
  logoutBtn.className = 'btn-logout';
  logoutBtn.href = 'javascript:void(0)';
  logoutBtn.textContent = '退出';
  logoutBtn.style.cssText = 'vertical-align: middle; font-size: 12px; color: #999; cursor: pointer; border: none; background: none; text-decoration: underline;';
  logoutBtn.addEventListener('click', logout);

  navUser.appendChild(avatar);
  navUser.appendChild(name);
  navUser.appendChild(logoutBtn);
}

// ==================== 退出登录 ====================

function logout() {
  localStorage.removeItem('user');
  showLoginButton();
  showToast('已退出登录', 'success');
}

// ==================== 回调处理 ====================

function handleCallback() {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  var state = params.get('state');
  var userDataParam = params.get('user_data');
  var platform = sessionStorage.getItem('oauth_platform');

  // 处理 GitHub/B站 直接返回的用户数据
  if (userDataParam) {
    try {
      var userData = JSON.parse(decodeURIComponent(userDataParam));
      localStorage.setItem('user', JSON.stringify(userData));

      var indexPath = window.location.pathname.replace(/auth\/callback\.html.*$/, '') || '/index.html';
      window.location.href = window.location.origin + indexPath;
      return;
    } catch (e) {
      showToast('用户数据解析失败', 'error');
      return;
    }
  }

  // QQ OAuth 回调
  if (platform === 'qq' && code) {
    var savedState = sessionStorage.getItem('oauth_state');
    if (!state || state !== savedState) {
      showToast('安全验证失败，请重新登录', 'error');
      sessionStorage.removeItem('oauth_state');
      return;
    }
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_platform');

    // 向 Worker 发送请求
    var workerUrl = AUTH_WORKER_URL + '/callback?code=' + encodeURIComponent(code);

    fetch(workerUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('请求失败: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (data.error) {
          throw new Error(data.error_msg || data.error || '获取用户信息失败');
        }

        var user = data.user || data;
        user.platform = 'qq';
        localStorage.setItem('user', JSON.stringify(user));

        var indexPath = window.location.pathname.replace(/auth\/callback\.html.*$/, '') || '/index.html';
        window.location.href = window.location.origin + indexPath;
      })
      .catch(function (err) {
        showToast('登录失败: ' + err.message, 'error');
      });
    return;
  }

  showToast('无效的回调请求', 'error');
}

// ==================== 初始化 ====================

function initAuth() {
  try {
    var userData = localStorage.getItem('user');
    if (userData) {
      var user = JSON.parse(userData);
      if (user && user.nickname) {
        updateNavUser(user);
      } else {
        showLoginButton();
      }
    } else {
      showLoginButton();
    }
  } catch (e) {
    showLoginButton();
  }
}

// ==================== 自动检测回调 ====================

(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.has('code') || params.has('user_data')) {
    handleCallback();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      initAuth();
    });
  }
})();
