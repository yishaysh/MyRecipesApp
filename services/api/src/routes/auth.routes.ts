import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { SyncService } from '../services/sync.service.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/v1/auth/google
  fastify.post('/google', async (request, reply) => {
    try {
      const body = request.body as { idToken?: string; mockUser?: any };
      if (!body || (!body.idToken && !body.mockUser)) {
        return reply.status(400).send({ error: 'Missing idToken' });
      }

      let googleUser;
      if (body.idToken) {
        googleUser = await AuthService.verifyGoogleToken(body.idToken);
      } else if (body.mockUser && process.env.NODE_ENV !== 'production') {
        // Strictly isolated to development and automated unit test environments
        googleUser = body.mockUser;
      }

      if (!googleUser) {
        return reply.status(401).send({ error: 'אימות מזהה Google נכשל (Invalid Google ID token)' });
      }

      const authResult = await AuthService.authenticateWithGoogle(googleUser);
      const usage = await SyncService.checkUsageLimit(authResult.user.userId);

      return reply.send({
        user: authResult.user,
        token: authResult.token,
        usage,
      });
    } catch (err: any) {
      console.error('[AUTH] Google auth endpoint error:', err);
      const isDev = process.env.NODE_ENV !== 'production';
      return reply.status(500).send({
        error: isDev ? (err?.message || 'Internal server error') : 'שגיאת שרת פנימית באימות Google',
      });
    }
  });

  // GET /api/v1/auth/google/mobile-bridge - Secure in-browser Google authentication bridge for mobile clients
  fastify.get('/google/mobile-bridge', async (_request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '1096327742778-q792b51k802ocfbs4f9pcn28bigb63ol.apps.googleusercontent.com';
    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>התחברות לאפליקציית ספר המתכונים שלי</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Heebo', sans-serif;
      background: #f4f9f5;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: #ffffff;
      border-radius: 24px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(6, 78, 59, 0.08);
      border: 1px solid #e2e8f0;
    }
    .icon { font-size: 3rem; margin-bottom: 12px; }
    h1 { font-size: 1.4rem; font-weight: 800; color: #064e3b; margin-bottom: 8px; }
    p { font-size: 0.95rem; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
    #g_id_signin { display: flex; justify-content: center; min-height: 48px; margin: 12px 0; }
    .status { margin-top: 16px; font-size: 0.9rem; font-weight: 600; }
    .app-btn {
      display: none;
      margin-top: 20px;
      padding: 14px 24px;
      background: #059669;
      color: #ffffff;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 800;
      font-size: 1rem;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🍲</div>
    <h1>ספר המתכונים שלי</h1>
    <p>התחבר עם חשבון Google כדי לסנכרן ולגבות את כל המתכונים שלך בענן מכל המכשירים.</p>

    <div id="g_id_signin"></div>
    <div id="status-text" class="status"></div>
    <a id="app-redirect-btn" class="app-btn" href="#">פתח באפליקציה ✨</a>
  </div>

  <script>
    const CLIENT_ID = '${clientId}';

    function handleCredentialResponse(response) {
      const status = document.getElementById('status-text');
      status.textContent = '⏳ מאמת התחברות עם השרת...';
      status.style.color = '#059669';

      fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.token) throw new Error(data.error || 'אימות נכשל');
        status.textContent = '🎉 התחברת בהצלחה! מעביר לאפליקציה...';
        const deepLink = 'myrecipes://auth?token=' + encodeURIComponent(data.token) + '&user=' + encodeURIComponent(JSON.stringify(data.user));
        const btn = document.getElementById('app-redirect-btn');
        btn.href = deepLink;
        btn.style.display = 'inline-block';
        window.location.href = deepLink;
      })
      .catch(err => {
        status.textContent = '⚠️ שגיאה: ' + (err.message || 'לא ניתן להתחבר');
        status.style.color = '#ef4444';
      });
    }

    window.onload = function() {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false
        });
        google.accounts.id.renderButton(
          document.getElementById('g_id_signin'),
          { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280, locale: 'he' }
        );
      }
    };
  </script>
</body>
</html>`;

    return reply.type('text/html; charset=utf-8').send(html);
  });

  // POST /api/v1/auth/guest
  fastify.post('/guest', async (_request, reply) => {
    const guestSession = await AuthService.createGuestSession();
    const usage = await SyncService.checkUsageLimit(guestSession.user.userId);
    return reply.send({
      user: guestSession.user,
      token: guestSession.token,
      usage,
    });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
    }

    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      user: session,
      usage,
    });
  });

  // POST /api/v1/auth/redeem-code
  fastify.post('/redeem-code', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const session = AuthService.verifySessionToken(token);
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized: Token expired or invalid' });
    }

    const body = request.body as { code?: string };
    if (!body || !body.code) {
      return reply.status(400).send({ error: 'נא להזין קוד הטבה' });
    }

    const result = await AuthService.redeemPromoCode(session, body.code);
    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    const usage = await SyncService.checkUsageLimit(session.userId);

    return reply.send({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      usage,
    });
  });
};

