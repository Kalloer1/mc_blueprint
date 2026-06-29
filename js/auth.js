/**
 * QQ OAuth 登录集成模块
 * 用于 Minecraft Blueprints 网站的 QQ 第三方登录
 */

// ==================== 配置常量 ====================

const QQ_APP_ID = '1112518560';

const QQ_REDIRECT_URI = (function () {
  const origin = window.location.origin;
  const path = window.location.pathname.replace(/[^/]*$/, '') + 'auth/callback.html';
  return origin + path;
})();

const QQ_AUTH_URL = 'https://graph.qq.com/oauth2.0/authorize';

// Cloudflare Worker 回调服务地址（用户需要自行配置）
const AUTH_WORKER_URL = '';

// ==================== 工具函数 ====================

/**
 * 生成随机 state 字符串，用于 CSRF 防护
 * @returns {string}
 */
function generateState() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ==================== Toast 提示 ====================

/**
 * 显示 Toast 提示消息
 * @param {string} message - 提示文本
 * @param {'success'|'error'} type - 提示类型
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

  // 显示
  requestAnimationFrame(function () {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // 3 秒后移除
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(function () {
      toast.className = '';
    }, 300);
  }, 3000);
}

// ==================== 登录按钮 ====================

/**
 * 在导航栏显示 QQ 登录按钮
 */
function showLoginButton() {
  var navUser = document.getElementById('nav-user');
  if (!navUser) return;

  // 清空内容
  navUser.innerHTML = '';

  // 创建登录按钮
  var btn = document.createElement('a');
  btn.className = 'btn-login';
  btn.href = 'javascript:void(0)';
  btn.title = '使用 QQ 账号登录';

  // QQ 图标 SVG（简洁的 Q 圆形图标）
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
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
  text.setAttribute('font-family', 'Arial, sans-serif');
  text.textContent = 'Q';

  svg.appendChild(circle);
  svg.appendChild(text);

  btn.appendChild(svg);
  btn.appendChild(document.createTextNode('QQ 登录'));

  btn.addEventListener('click', function () {
    var state = generateState();
    sessionStorage.setItem('qq_oauth_state', state);

    var authUrl = QQ_AUTH_URL
      + '?response_type=code'
      + '&client_id=' + QQ_APP_ID
      + '&redirect_uri=' + encodeURIComponent(QQ_REDIRECT_URI)
      + '&state=' + state;

    window.location.href = authUrl;
  });

  navUser.appendChild(btn);
}

// ==================== 用户状态显示 ====================

/**
 * 更新导航栏用户状态（已登录）
 * @param {object} user - QQ 用户信息对象
 */
function updateNavUser(user) {
  var navUser = document.getElementById('nav-user');
  if (!navUser || !user) return;

  navUser.innerHTML = '';

  // 头像
  var avatar = document.createElement('img');
  avatar.className = 'user-avatar';
  avatar.src = user.figureurl_qq_2 || user.figureurl_qq_1 || user.figureurl || '';
  avatar.alt = user.nickname || '用户头像';
  avatar.title = user.nickname || '';
  avatar.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 6px; border: 2px solid rgba(255,255,255,0.3);';

  // 用户名
  var name = document.createElement('span');
  name.className = 'user-name';
  name.textContent = user.nickname || 'QQ用户';
  name.style.cssText = 'vertical-align: middle; margin-right: 8px; font-size: 14px; color: #333;';

  // 退出按钮
  var logoutBtn = document.createElement('a');
  logoutBtn.className = 'btn-logout';
  logoutBtn.href = 'javascript:void(0)';
  logoutBtn.textContent = '退出';
  logoutBtn.style.cssText = 'vertical-align: middle; font-size: 12px; color: #999; cursor: pointer; border: none; background: none; text-decoration: underline;';
  logoutBtn.addEventListener('click', function () {
    logout();
  });

  navUser.appendChild(avatar);
  navUser.appendChild(name);
  navUser.appendChild(logoutBtn);
}

// ==================== 退出登录 ====================

/**
 * 退出登录
 */
function logout() {
  localStorage.removeItem('qq_user');
  showLoginButton();
  showToast('已退出登录', 'success');
}

// ==================== 回调处理 ====================

/**
 * 处理 QQ OAuth 回调
 * 从 URL 中获取 code 和 state，验证后向 Worker 请求用户信息
 */
function handleQQCallback() {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  var state = params.get('state');

  if (!code) {
    showToast('回调参数缺少 code', 'error');
    return;
  }

  // 验证 state 防止 CSRF 攻击
  var savedState = sessionStorage.getItem('qq_oauth_state');
  if (!state || state !== savedState) {
    showToast('安全验证失败，请重新登录', 'error');
    sessionStorage.removeItem('qq_oauth_state');
    return;
  }
  sessionStorage.removeItem('qq_oauth_state');

  // 检查 Worker URL 是否已配置
  if (!AUTH_WORKER_URL) {
    showToast('请先配置 OAuth 回调服务地址（Cloudflare Worker）', 'error');

    // 在页面上显示详细配置说明
    var info = document.createElement('div');
    info.style.cssText = `
      max-width: 600px;
      margin: 40px auto;
      padding: 24px;
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 8px;
      font-family: sans-serif;
      line-height: 1.8;
      color: #333;
    `;
    info.innerHTML = `
      <h3 style="margin: 0 0 12px 0; color: #f57c00;">配置提示</h3>
      <p>QQ OAuth 回调功能需要配置 Cloudflare Worker 服务地址才能使用。</p>
      <p><strong>配置步骤：</strong></p>
      <ol style="padding-left: 20px;">
        <li>部署一个 Cloudflare Worker 来处理 QQ OAuth 回调</li>
        <li>Worker 需要：<br>
          &nbsp;&nbsp;- 用 <code>code</code> 换取 <code>access_token</code><br>
          &nbsp;&nbsp;- 用 <code>access_token</code> 获取 <code>openid</code><br>
          &nbsp;&nbsp;- 用 <code>access_token</code> + <code>openid</code> 获取用户信息<br>
          &nbsp;&nbsp;- 返回 JSON 格式的用户信息
        </li>
        <li>在 <code>js/auth.js</code> 中将 <code>AUTH_WORKER_URL</code> 设置为你的 Worker 地址</li>
      </ol>
      <p style="margin-top: 12px;">
        <a href="../index.html" style="color: #1976d2;">返回首页</a>
      </p>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(info);
    return;
  }

  // 向 Worker 发送请求
  var workerUrl = AUTH_WORKER_URL + '?code=' + encodeURIComponent(code);

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

      // 保存用户信息到 localStorage
      localStorage.setItem('qq_user', JSON.stringify(data));

      // 跳转回首页
      var indexPath = window.location.pathname.replace(/auth\/callback\.html.*$/, '') || '/index.html';
      window.location.href = window.location.origin + indexPath;
    })
    .catch(function (err) {
      showToast('登录失败: ' + err.message, 'error');
    });
}

// ==================== 初始化 ====================

/**
 * 初始化认证模块
 * 检查本地存储的用户信息，更新导航栏状态
 */
function initAuth() {
  try {
    var userData = localStorage.getItem('qq_user');
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

// 检查当前页面 URL 是否包含 code 参数（QQ 回调）
(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    // 在回调页面，执行回调处理
    handleQQCallback();
  } else {
    // 普通页面，DOM 加载完成后初始化认证
    document.addEventListener('DOMContentLoaded', function () {
      initAuth();
    });
  }
})();
