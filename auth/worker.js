// ===== Cloudflare Worker for QQ OAuth Callback =====
// 部署到 Cloudflare Workers 后，将 AUTH_WORKER_URL 设置为此 Worker 的 URL

// QQ 互联应用配置
const QQ_APP_ID = '1232133123312';
const QQ_APP_KEY = 'Ps6saadtZEMLWTbQ';

// 你的网站回调地址（部署后修改为实际地址）
// 例如: https://yourname.github.io/minecraft-blueprints/auth/callback.html
const QQ_REDIRECT_URI = 'https://yourname.github.io/minecraft-blueprints/auth/callback.html';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // /callback?code=xxx - OAuth 回调处理
    if (url.pathname === '/callback' || url.pathname === '/') {
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response(
          JSON.stringify({ error: '缺少授权码 (code)' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      try {
        // Step 1: 用授权码换取 Access Token
        const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${QQ_APP_ID}&client_secret=${QQ_APP_KEY}&code=${code}&redirect_uri=${encodeURIComponent(QQ_REDIRECT_URI)}`;

        const tokenResponse = await fetch(tokenUrl);
        const tokenText = await tokenResponse.text();

        // QQ 返回的是 text/plain 格式: access_token=xxx&expires_in=xxx&refresh_token=xxx
        const tokenParams = new URLSearchParams(tokenText);
        const accessToken = tokenParams.get('access_token');

        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: '获取 Access Token 失败', raw: tokenText }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Step 2: 获取 OpenID
        const openidUrl = `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`;
        const openidResponse = await fetch(openidUrl);
        const openidText = await openidResponse.text();

        // QQ 返回格式: callback( {"client_id":"xxx","openid":"xxx"} );
        const jsonMatch = openidText.match(/\{[^}]+\}/);
        if (!jsonMatch) {
          return new Response(
            JSON.stringify({ error: '获取 OpenID 失败', raw: openidText }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const openidData = JSON.parse(jsonMatch[0]);
        const openid = openidData.openid;

        // Step 3: 获取用户信息
        const userInfoUrl = `https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${QQ_APP_ID}&openid=${openid}`;
        const userInfoResponse = await fetch(userInfoUrl);
        const userInfo = await userInfoResponse.json();

        if (userInfo.ret !== 0) {
          return new Response(
            JSON.stringify({ error: '获取用户信息失败', info: userInfo }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // 返回用户信息给前端
        const userData = {
          openid: openid,
          nickname: userInfo.nickname,
          figureurl: userInfo.figureurl,
          figureurl_1: userInfo.figureurl_1,
          figureurl_2: userInfo.figureurl_2,
          figureurl_qq_1: userInfo.figureurl_qq_1,
          figureurl_qq_2: userInfo.figureurl_qq_2,
          gender: userInfo.gender,
        };

        return new Response(
          JSON.stringify({ success: true, user: userData }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({ error: '服务器错误', message: err.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    return new Response('QQ OAuth Worker - Minecraft Blueprints', { status: 200 });
  }
};
