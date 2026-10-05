import { Hono } from 'hono';
import { CONFIG } from '../config.js';

export const proxyRouter = new Hono();

// Kuramanime's kDrive CDN rotates through several mirror hosts and all of
// them expect the Kuramanime referer. Everything else falls back to LK21.
const KURAMANIME_HOST_MARKERS = ['kurama', 'kdrive', 'horikita', 'kitasan', 'amiya', 'iino'];

// Google-hosted media (Drive-backed HLS segments etc.) answers HTTP 429 when a
// foreign Referer is attached, so these hosts must be fetched with no Referer.
const GOOGLE_MEDIA_HOSTS = /(^|\.)(googleusercontent|googleapis|gstatic|googlevideo)\.com$/;

function resolveStreamReferer(hostname) {
  if (GOOGLE_MEDIA_HOSTS.test(hostname)) {
    return null;
  }
  return KURAMANIME_HOST_MARKERS.some((marker) => hostname.includes(marker))
    ? `${CONFIG.UPSTREAMS.KURAMANIME}/`
    : `${CONFIG.UPSTREAMS.LK21}/`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch an upstream media URL with a connect/TTFB deadline instead of a
 * whole-response deadline.
 *
 * WHY: AbortSignal.timeout() keeps ticking after the response starts, so it
 * aborts the response BODY mid-transfer - a long MP4 gets cut off after N
 * seconds and the player surfaces a "network error". Here the timer is
 * cleared as soon as upstream response headers arrive, so the body then
 * streams with no deadline. Client disconnects (seek / tab close / episode
 * switch) are forwarded upstream so we stop pulling bytes nobody watches.
 */
async function fetchUpstream(url, headers, clientSignal) {
  const controller = new AbortController();
  let connected = false;

  const connectTimer = setTimeout(() => {
    if (!connected) {
      controller.abort(
        new Error(`Upstream connect timeout (${CONFIG.STREAM_CONNECT_TIMEOUT_MS}ms)`)
      );
    }
  }, CONFIG.STREAM_CONNECT_TIMEOUT_MS);

  const abortFromClient = () => controller.abort(new Error('Client closed the connection'));
  if (clientSignal) {
    if (clientSignal.aborted) {
      abortFromClient();
    } else {
      clientSignal.addEventListener('abort', abortFromClient, { once: true });
    }
  }

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    connected = true;
    return response;
  } finally {
    clearTimeout(connectTimer);
    // Setelah koneksi upstream terbentuk, berhenti meneruskan abort client ke
    // koneksi ini: pemanggil akan membatalkan BODY stream secara eksplisit
    // (lihat watchClientDisconnect), sehingga penutupan berjalan bersih dan
    // tidak memunculkan error abort yang tidak tertangkap di log.
    if (clientSignal) {
      clientSignal.removeEventListener('abort', abortFromClient);
    }
  }
}

/**
 * Saat client pergi di tengah streaming (seek / ganti episode / tutup tab),
 * batalkan body upstream agar koneksi ke CDN ikut berhenti - tanpa
 * meng-abort controller fetch (yang akan melempar error ke log server).
 */
function watchClientDisconnect(clientSignal, response) {
  if (!clientSignal || !response.body) return;

  const cancelBody = () => {
    response.body?.cancel().catch(() => {
      // stream sudah selesai/dibatalkan - tidak ada yang perlu dibersihkan
    });
  };

  if (clientSignal.aborted) {
    cancelBody();
  } else {
    clientSignal.addEventListener('abort', cancelBody, { once: true });
  }
}

async function fetchUpstreamWithRetry(url, headers, clientSignal) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetchUpstream(url, headers, clientSignal);
    } catch (error) {
      lastError = error;
      // Client is gone - retrying would only waste bandwidth.
      if (clientSignal?.aborted) throw error;
      if (attempt < 2) await sleep(400);
    }
  }
  throw lastError;
}

/**
 * Unified Video Stream Proxy (HLS & MP4 Range Streaming)
 */
export async function handleStreamProxy(c) {
  const targetUrl = c.req.query('url');

  if (!targetUrl) {
    return c.text('Missing target url query parameter (?url=...)', 400);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return c.text('Invalid target URL', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return c.text('Invalid URL protocol', 400);
  }

  const referer = resolveStreamReferer(parsed.hostname);
  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    Accept: '*/*'
  };
  if (referer) headers.Referer = referer;

  // Forward client range header if present (essential for seeking & 206 Partial Content)
  const range = c.req.header('range');
  if (range) {
    headers.Range = range;
  }

  const clientSignal = c.req.raw?.signal;

  try {
    const response = await fetchUpstreamWithRetry(targetUrl, headers, clientSignal);

    if (!response.ok && response.status !== 206) {
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // body already consumed/closed - nothing to clean up
        }
      }
      return c.text(`Upstream stream returned HTTP ${response.status}`, response.status);
    }

    watchClientDisconnect(clientSignal, response);

    const outHeaders = new Headers();
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Allow-Headers', 'Range');
    outHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    outHeaders.set('Accept-Ranges', 'bytes');

    const contentType = response.headers.get('content-type');
    if (contentType) outHeaders.set('Content-Type', contentType);

    const contentLength = response.headers.get('content-length');
    if (contentLength) outHeaders.set('Content-Length', contentLength);

    const contentRange = response.headers.get('content-range');
    if (contentRange) outHeaders.set('Content-Range', contentRange);

    return new Response(response.body, {
      status: response.status,
      headers: outHeaders
    });
  } catch (error) {
    if (clientSignal?.aborted) {
      // Player seeked / switched episode / closed tab - not a server fault.
      return c.text('Client closed the connection', 499);
    }
    return c.text(`Proxy stream error: ${error.message}`, 500);
  }
}

/**
 * Unified Image Stream Proxy (Covers, Posters, Chapter Pages)
 */
export async function handleImageProxy(c) {
  const targetUrl = c.req.query('url');

  if (!targetUrl) {
    return c.text('Missing target url query parameter (?url=...)', 400);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return c.text('Invalid target URL', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return c.text('Invalid URL protocol', 400);
  }

  let referer = `${CONFIG.UPSTREAMS.IKIRU}/`;
  if (parsed.hostname.includes('kurama') || parsed.hostname.includes('nyomo')) {
    referer = `${CONFIG.UPSTREAMS.KURAMANIME}/`;
  } else if (parsed.hostname.includes('lk21') || parsed.hostname.includes('assetsy')) {
    referer = `${CONFIG.UPSTREAMS.LK21}/`;
  }

  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    Referer: referer,
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  const clientSignal = c.req.raw?.signal;

  try {
    const response = await fetchUpstreamWithRetry(targetUrl, headers, clientSignal);

    if (!response.ok) {
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // body already consumed/closed - nothing to clean up
        }
      }
      return c.text(`Upstream image returned HTTP ${response.status}`, response.status);
    }

    watchClientDisconnect(clientSignal, response);

    const outHeaders = new Headers();
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Cache-Control', 'public, max-age=86400, immutable');

    const contentType = response.headers.get('content-type');
    if (contentType) outHeaders.set('Content-Type', contentType);

    return new Response(response.body, {
      status: 200,
      headers: outHeaders
    });
  } catch (error) {
    if (clientSignal?.aborted) {
      return c.text('Client closed the connection', 499);
    }
    return c.text(`Proxy image error: ${error.message}`, 500);
  }
}

/**
 * LK21 upstreams serve TS segments in forms a browser cannot consume directly:
 *   - p2p (playcdn.de): segments are raw TS but the CDN sends no CORS headers,
 *     so hls.js is blocked by the browser.
 *   - turbovip: segments are a small PNG stub followed by the raw TS payload
 *     (TS sync byte 0x47 repeating every 188 bytes).
 * This endpoint fetches the segment server-side, strips any wrapper and
 * returns clean `video/mp2t` bytes with permissive CORS.
 */
function findTsSyncOffset(buf) {
  const max = Math.min(buf.length - 376, 65536);
  for (let i = 0; i <= max; i += 1) {
    if (buf[i] === 0x47 && buf[i + 188] === 0x47 && buf[i + 376] === 0x47) {
      return i;
    }
  }
  return -1;
}

function stripSegmentWrapper(buf) {
  if (buf.length === 0 || buf[0] === 0x47) return buf; // already raw TS
  const offset = findTsSyncOffset(buf);
  return offset > 0 ? buf.subarray(offset) : buf;
}

export async function handleTsProxy(c) {
  const targetUrl = c.req.query('url');

  if (!targetUrl) {
    return c.text('Missing target url query parameter (?url=...)', 400);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return c.text('Invalid target URL', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return c.text('Invalid URL protocol', 400);
  }

  const referer = resolveStreamReferer(parsed.hostname);
  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    Accept: '*/*'
  };
  if (referer) headers.Referer = referer;

  const clientSignal = c.req.raw?.signal;

  try {
    const response = await fetchUpstreamWithRetry(targetUrl, headers, clientSignal);

    if (!response.ok && response.status !== 206) {
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // body already consumed/closed - nothing to clean up
        }
      }
      return c.text(`Upstream segment returned HTTP ${response.status}`, response.status);
    }

    watchClientDisconnect(clientSignal, response);

    const raw = Buffer.from(await response.arrayBuffer());
    const payload = stripSegmentWrapper(raw);

    const outHeaders = new Headers();
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Allow-Headers', 'Range');
    outHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    outHeaders.set('Accept-Ranges', 'bytes');
    outHeaders.set('Content-Type', 'video/mp2t');
    outHeaders.set('Content-Length', String(payload.length));
    outHeaders.set('Cache-Control', 'public, max-age=300');

    return new Response(payload, { status: 200, headers: outHeaders });
  } catch (error) {
    if (clientSignal?.aborted) {
      return c.text('Client closed the connection', 499);
    }
    return c.text(`Proxy segment error: ${error.message}`, 500);
  }
}

/**
 * HLS playlist proxy: fetches the upstream m3u8 and rewrites every segment
 * URI through /api/v1/proxy/ts (and nested playlists through /proxy/hls), so
 * the browser never talks to CDNs that lack CORS or wrap their segments.
 */
function rewriteHlsPlaylist(text, baseUrl, origin) {
  const rewriteUri = (uri) => {
    try {
      const abs = new URL(uri, baseUrl).href;
      const path = new URL(abs).pathname;
      const isPlaylist = /\.m3u8$/i.test(path);
      const proxyPath = isPlaylist ? '/api/v1/proxy/hls' : '/api/v1/proxy/ts';
      return `${origin}${proxyPath}?url=${encodeURIComponent(abs)}`;
    } catch {
      return uri;
    }
  };

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI attributes inside tags (e.g. #EXT-X-KEY / #EXT-X-MAP)
        if (trimmed.startsWith('#EXT-X-KEY:') || trimmed.startsWith('#EXT-X-MAP:')) {
          return line.replace(/URI="([^"]+)"/g, (match, uri) => `URI="${rewriteUri(uri)}"`);
        }
        return line;
      }
      return rewriteUri(trimmed);
    })
    .join('\n');
}

export async function handleHlsProxy(c) {
  const targetUrl = c.req.query('url');

  if (!targetUrl) {
    return c.text('Missing target url query parameter (?url=...)', 400);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return c.text('Invalid target URL', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return c.text('Invalid URL protocol', 400);
  }

  const referer = resolveStreamReferer(parsed.hostname);
  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    Accept: '*/*'
  };
  if (referer) headers.Referer = referer;

  const clientSignal = c.req.raw?.signal;

  try {
    const response = await fetchUpstreamWithRetry(targetUrl, headers, clientSignal);

    if (!response.ok) {
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // body already consumed/closed - nothing to clean up
        }
      }
      return c.text(`Upstream playlist returned HTTP ${response.status}`, response.status);
    }

    watchClientDisconnect(clientSignal, response);

    const text = await response.text();

    // Public origin the browser used to reach us (works behind the
    // cloudflared tunnel and on localhost during development).
    const host = c.req.header('host') || 'localhost:3005';
    const forwardedProto = c.req.header('x-forwarded-proto');
    const proto = forwardedProto || (/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https');
    const origin = `${proto}://${host}`;

    const rewritten = rewriteHlsPlaylist(text, targetUrl, origin);

    const outHeaders = new Headers();
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
    outHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(rewritten, { status: 200, headers: outHeaders });
  } catch (error) {
    if (clientSignal?.aborted) {
      return c.text('Client closed the connection', 499);
    }
    return c.text(`Proxy playlist error: ${error.message}`, 500);
  }
}

proxyRouter.get('/stream', handleStreamProxy);
proxyRouter.get('/image', handleImageProxy);
proxyRouter.get('/ts', handleTsProxy);
proxyRouter.get('/hls', handleHlsProxy);
