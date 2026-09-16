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
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      const finalUrl = response.url || urlToFetch;
      const match =
        finalUrl.match(/video\/(\d+)/i) ||
        finalUrl.match(/modal\/video\/(\d+)/i) ||
        targetUrl.match(/video\/(\d+)/i);

      const videoId = match ? match[1] : '';
      const openEmbedUrl = videoId
        ? `https://open.douyin.com/player/video?vid=${videoId}`
        : finalUrl;
      const pcUrl = videoId ? `https://www.douyin.com/video/${videoId}` : finalUrl;

      return res.json({
        success: true,
        originalUrl: targetUrl,
        finalUrl,
        videoId,
        openEmbedUrl,
        pcUrl,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to resolve URL' });
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
