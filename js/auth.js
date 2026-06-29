/**
 * GitHub OAuth 登录集成模块
 */

// ==================== 配置常量 ====================

// Cloudflare Worker 地址
const AUTH_WORKER_URL = 'https://qq-auth.wqclo.workers.dev';

// GitHub OAuth 配置
const GITHUB_APP_ID = 'Ov23liYANHGQgZXXbIzC'; // 替换为你的 GitHub OAuth App ID

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
  const state = generateState();
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_platform', 'github');

  const redirectUri = AUTH_WORKER_URL + '/auth/github/callback';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;

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
  var githubBtn = document.createElement('a');
  githubBtn.className = 'btn-login btn-github';
  githubBtn.href = 'javascript:void(0)';
  githubBtn.title = '使用 GitHub 账号登录';
  githubBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub 登录';
  githubBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: #24292e; color: #fff; border-radius: 6px; font-size: 14px; text-decoration: none; transition: background 0.2s;';
  githubBtn.addEventListener('mouseenter', function() { this.style.background = '#373e47'; });
  githubBtn.addEventListener('mouseleave', function() { this.style.background = '#24292e'; });
  githubBtn.addEventListener('click', loginWithGitHub);

  container.appendChild(githubBtn);
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
  avatar.src = user.avatar || '';
  avatar.alt = user.nickname || '用户头像';
  avatar.title = user.nickname || '';
  avatar.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 6px; border: 2px solid rgba(255,255,255,0.3);';

  // 用户名
  var name = document.createElement('span');
  name.className = 'user-name';
  name.textContent = user.nickname || 'GitHub 用户';
  name.style.cssText = 'vertical-align: middle; margin-right: 8px; font-size: 14px; color: #333;';

  // 个人中心链接
  var profileLink = document.createElement('a');
  profileLink.href = './profile.html';
  profileLink.textContent = '个人中心';
  profileLink.style.cssText = 'vertical-align: middle; font-size: 12px; color: #4af5e6; margin-right: 8px; text-decoration: none;';

  // 退出按钮
  var logoutBtn = document.createElement('a');
  logoutBtn.className = 'btn-logout';
  logoutBtn.href = 'javascript:void(0)';
  logoutBtn.textContent = '退出';
  logoutBtn.style.cssText = 'vertical-align: middle; font-size: 12px; color: #999; cursor: pointer; border: none; background: none; text-decoration: underline;';
  logoutBtn.addEventListener('click', logout);

  navUser.appendChild(avatar);
  navUser.appendChild(name);
  navUser.appendChild(profileLink);
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
  var userDataParam = params.get('user_data');

  if (userDataParam) {
    try {
      var userData = JSON.parse(decodeURIComponent(userDataParam));
      localStorage.setItem('user', JSON.stringify(userData));

      var statusText = document.getElementById('status-text');
      var spinner = document.getElementById('spinner');
      if (statusText) statusText.textContent = '登录成功！正在跳转...';
      if (spinner) spinner.style.display = 'none';

      setTimeout(function() {
        window.location.href = 'https://kalloer1.github.io/mc_blueprint/';
      }, 1500);
      return;
    } catch (e) {
      try {
        var userData2 = JSON.parse(userDataParam);
        localStorage.setItem('user', JSON.stringify(userData2));

        var statusText = document.getElementById('status-text');
        var spinner = document.getElementById('spinner');
        if (statusText) statusText.textContent = '登录成功！正在跳转...';
        if (spinner) spinner.style.display = 'none';

        setTimeout(function() {
          window.location.href = 'https://kalloer1.github.io/mc_blueprint/';
        }, 1500);
        return;
      } catch (e2) {
        var errorDiv = document.getElementById('callback-error');
        if (errorDiv) {
          errorDiv.textContent = '用户数据解析失败: ' + e2.message;
          errorDiv.style.display = 'block';
        }
        return;
      }
    }
  }

  var errorDiv = document.getElementById('callback-error');
  if (errorDiv) {
    errorDiv.textContent = '无效的回调请求，缺少 user_data 参数';
    errorDiv.style.display = 'block';
  }
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
  if (params.has('user_data')) {
    handleCallback();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      initAuth();
    });
  }
})();