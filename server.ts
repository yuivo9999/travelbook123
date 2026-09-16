import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Douyin & Social Video Short Link Resolver
  app.get('/api/douyin-resolve', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      let urlToFetch = targetUrl.trim();
      if (!/^https?:\/\//i.test(urlToFetch)) {
        urlToFetch = 'https://' + urlToFetch;
      }

      const response = await fetch(urlToFetch, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      const finalUrl = response.url || urlToFetch;
      const match =
        finalUrl.match(/video\/(\d+)/i) ||
        finalUrl.match(/modal\/video\/(\d+)/i) ||
        targetUrl.match(/video\/(\d+)/i);

      const videoId = match ? match[1] : '';
      const mDouyinUrl = videoId ? `https://m.douyin.com/share/video/${videoId}` : finalUrl;
      const openEmbedUrl = videoId
        ? `https://open.douyin.com/player/video?vid=${videoId}`
        : finalUrl;
      const pcUrl = videoId ? `https://www.douyin.com/video/${videoId}` : finalUrl;

      return res.json({
        success: true,
        originalUrl: targetUrl,
        finalUrl,
        videoId,
        mDouyinUrl,
        openEmbedUrl,
        pcUrl,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to resolve URL' });
    }
  });

  // Douyin Desktop Site Proxy (桌面版网站代理)
  app.get('/api/douyin-proxy', async (req, res) => {
    const rawUrl = req.query.url as string;
    const mode = (req.query.mode as string) || 'open'; // 'open' | 'pc'
    if (!rawUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      let targetUrl = rawUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      // 1. Resolve short link to find videoId
      let videoId = '';
      const matchDirect = targetUrl.match(/video\/(\d+)/i) || targetUrl.match(/modal\/video\/(\d+)/i);
      if (matchDirect) {
        videoId = matchDirect[1];
      } else {
        const redirectRes = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });
        const finalUrl = redirectRes.url || targetUrl;
        const matchResolved = finalUrl.match(/video\/(\d+)/i) || finalUrl.match(/modal\/video\/(\d+)/i);
        if (matchResolved) {
          videoId = matchResolved[1];
        }
      }

      // Determine fetch URL
      let fetchUrl = targetUrl;
      let baseUrl = 'https://www.douyin.com/';

      if (videoId) {
        if (mode === 'pc') {
          fetchUrl = `https://www.douyin.com/video/${videoId}`;
          baseUrl = 'https://www.douyin.com/';
        } else {
          fetchUrl = `https://open.douyin.com/player/video?vid=${videoId}`;
          baseUrl = 'https://open.douyin.com/';
        }
      }

      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cookie': 'passport_csrf_token=123; tt_webid=7448945007127497999;',
        },
      });

      let html = await response.text();

      // Inject PC User-Agent spoofing and Base URL into HTML
      const pcSpoofScript = `
        <script>
          (function() {
            const pcUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            try {
              Object.defineProperty(navigator, 'userAgent', { get: () => pcUA, configurable: true });
              Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
              Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });
            } catch(e) {}
            window.open = function() { return null; };
          })();
        </script>
        <base href="${baseUrl}" />
      `;

      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${pcSpoofScript}`);
      } else if (html.includes('<html>')) {
        html = html.replace('<html>', `<html><head>${pcSpoofScript}</head>`);
      } else {
        html = pcSpoofScript + html;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      return res.send(html);
    } catch (err: any) {
      return res.status(500).send(`Failed to proxy Douyin: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
