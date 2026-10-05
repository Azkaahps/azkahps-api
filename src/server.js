import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { CONFIG } from './config.js';
import { registerProviders } from './providers/registry.js';
import { proxyRouter, handleStreamProxy, handleImageProxy } from './routes/proxy.js';
import { hydraxRouter } from './routes/hydrax.js';
import { healthRouter } from './routes/health.js';
import { renderDocsHtml } from './views/docs.js';
import { renderEmbedPlayer } from './views/embed.js';
import { getStreamUrl } from './providers/movie/lk21/client.js';
import { cache } from './cache.js';

const app = new Hono();

// Global CORS Middleware
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  c.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
});

// CORS preflight: browser mengirim OPTIONS sebelum POST JSON cross-origin.
// Tanpa handler ini Hono membalas 404 dan preflight gagal (POST diblokir browser).
app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  c.header('Access-Control-Max-Age', '86400');
  return c.body(null, 204);
});

// Request Logger Middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const status = c.res.status;
  const method = c.req.method;
  const url = c.req.path;
  console.log(`[${new Date().toISOString()}] ${method} ${url} -> ${status} (${ms}ms)`);
});

// Documentation UI & Developer Portal
app.get('/', (c) => c.html(renderDocsHtml()));
app.get('/docs', (c) => c.html(renderDocsHtml()));

// System Health & Metrics
app.route('/', healthRouter);
app.route('/api/v1', healthRouter);

// Mount Unified Media Proxy under /api/v1/proxy
const v1 = new Hono();
v1.route('/proxy', proxyRouter);
v1.route('/proxy/hydrax', hydraxRouter);

// Mount All Scraper Providers via Registry under /api/v1/*
registerProviders(v1);

// Attach V1 Router to App
app.route('/api/v1', v1);

// Backward Compatibility Routes for Video Streaming & Proxy
app.get('/api/proxy-stream', handleStreamProxy);
app.get('/api/v1/proxy/stream', handleStreamProxy);
app.get('/api/proxy-img', handleImageProxy);
app.get('/api/v1/proxy/image', handleImageProxy);

// Iframe Video Embed Player (/api/embed/:server/:id & /api/v1/movie/embed/:server/:id)
async function handleEmbedRoute(c) {
  const server = c.req.param('server');
  const id = c.req.param('id');
  const cacheKey = `embed:${server}:${id}`;
  const cachedHtml = cache.get(cacheKey);
  if (cachedHtml) {
    return c.html(cachedHtml);
  }

  try {
    const streamData = await getStreamUrl(server, id);
    const streamUrl = streamData.fileUrl
      ? (streamData.fileUrl.startsWith('/')
          ? streamData.fileUrl
          : streamData.streamType === 'mp4'
            ? `/api/v1/proxy/stream?url=${encodeURIComponent(streamData.fileUrl)}`
            : `/api/v1/proxy/hls?url=${encodeURIComponent(streamData.fileUrl)}`)
      : '';
    const html = renderEmbedPlayer({
      title: streamData.title,
      poster: streamData.poster,
      streamUrl,
      server,
      id,
      streamType: streamData.streamType
    });
    cache.set(cacheKey, html, CONFIG.CACHE_TTL.STREAM);
    return c.html(html);
  } catch (err) {
    const html = renderEmbedPlayer({
      title: 'Player Error',
      poster: '',
      streamUrl: '',
      server,
      id
    });
    return c.html(html, 200);
  }
}

app.get('/api/embed/:server/:id', handleEmbedRoute);
app.get('/api/v1/movie/embed/:server/:id', handleEmbedRoute);

// 404 Not Found Handler
app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: 'Not Found',
      message: `Route '${c.req.path}' does not exist. Visit /docs for the API reference.`
    },
    404
  );
});

// Global Error Handler
app.onError((err, c) => {
  console.error('[Unhandled Server Error]:', err);
  return c.json(
    {
      ok: false,
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred'
    },
    500
  );
});

// Start Server
const port = CONFIG.PORT;
const host = CONFIG.HOST;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host
  },
  (info) => {
    console.log(`=======================================================`);
    console.log(`⚡ AZKAHPS UNIFIED MEDIA REST API IS LIVE!`);
    console.log(`📡 URL:       http://localhost:${info.port}`);
    console.log(`📖 Docs:      http://localhost:${info.port}/docs`);
    console.log(`🔌 Providers: Movie (LK21) | Anime (Kurama) | Comic (Ikiru)`);
    console.log(`🛠️ Engine:    Hono v4 + Node.js (Modular Monolith)`);
    console.log(`=======================================================`);
  }
);
