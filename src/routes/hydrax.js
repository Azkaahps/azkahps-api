import { Hono } from 'hono';
import {
  fetchHydraxMedia,
  listHydraxSources,
  pickHydraxSource,
  buildHydraxChunkUrl,
  fetchHydraxChunk,
  HYDRAX_CHUNK_SIZE,
} from '../providers/movie/lk21/hydrax.js';
import { CONFIG } from '../config.js';

export const hydraxRouter = new Hono();

const HYDRAX_REFERER = 'https://player.abyssplayer.com/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChunkWithRetry(url, opts, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchHydraxChunk(url, opts);
      if (res.ok || res.status === 206) return res;
      lastErr = new Error(`Hydrax edge HTTP ${res.status}`);
      if (res.body) await res.body.cancel().catch(() => {});
    } catch (err) {
      lastErr = err;
    }
    if (opts.signal?.aborted) throw lastErr;
    if (i < attempts) await sleep(250 * i);
  }
  throw lastErr;
}

/**
 * GET /api/v1/proxy/hydrax/stream/:slug?res=5
 *
 * Virtual MP4 endpoint: presents a hydrax source as ONE continuous MP4 file.
 * - First request (no Range): resolves media, sends 200 + Accept-Ranges + Content-Length.
 * - Range requests: chunk index = floor(start / 2MiB); each edge chunk supports
 *   Range internally, so we fetch the minimal slice and stream bytes back.
 * - Ranges spanning chunk boundaries are streamed chunk-by-chunk (capped per request).
 */
hydraxRouter.get('/stream/:slug', async (c) => {
  const slug = c.req.param('slug');
  const resId = c.req.query('res') || null;
  const rangeHeader = c.req.header('range');
  const clientSignal = c.req.raw?.signal;

  let ctx;
  try {
    ctx = await fetchHydraxMedia(slug);
  } catch (err) {
    return c.text(`Hydrax resolve failed: ${err.message}`, 502);
  }

  let source;
  try {
    source = pickHydraxSource(ctx.media, resId);
  } catch (err) {
    return c.text(`Hydrax source failed: ${err.message}`, 502);
  }

  const totalSize = source.size;
  const outHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-store',
  });

  const sourcesMeta = {
    'X-Hydrax-Source': `${source.label || 'auto'}/res${source.res_id}`,
    'X-Hydrax-Codec': source.codec,
    'X-Hydrax-Chunks': String(Math.ceil(totalSize / HYDRAX_CHUNK_SIZE)),
  };
  for (const [k, v] of Object.entries(sourcesMeta)) outHeaders.set(k, v);

  // Parse Range: bytes=start-end
  let start = 0;
  let end = totalSize - 1;
  let isRange = false;
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      start = parseInt(m[1], 10);
      if (m[2]) end = Math.min(parseInt(m[2], 10), totalSize - 1);
      isRange = true;
      if (start >= totalSize || start > end) {
        return c.text('Range Not Satisfiable', 416, {
          'Content-Range': `bytes */${totalSize}`,
        });
      }
    }
  }

  const length = end - start + 1;
  outHeaders.set('Content-Length', String(length));
  if (isRange) {
    outHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
  }

  // Stream chunks lazily: fetch on demand, respecting the client range window.
  const firstChunk = Math.floor(start / HYDRAX_CHUNK_SIZE);
  const lastChunk = Math.floor(end / HYDRAX_CHUNK_SIZE);

  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false;
      const onAbort = () => {
        aborted = true;
      };
      clientSignal?.addEventListener('abort', onAbort, { once: true });

      try {
        for (let chunkIdx = firstChunk; chunkIdx <= lastChunk; chunkIdx++) {
          if (aborted) break;

          const chunkStart = chunkIdx * HYDRAX_CHUNK_SIZE;
          const chunkEnd = Math.min(chunkStart + HYDRAX_CHUNK_SIZE - 1, totalSize - 1);
          const sliceStart = Math.max(start, chunkStart) - chunkStart;
          const sliceEnd = Math.min(end, chunkEnd) - chunkStart;

          const url = buildHydraxChunkUrl(ctx, source, chunkIdx);
          const upstream = await fetchChunkWithRetry(url, {
            start: sliceStart,
            end: sliceEnd,
            signal: clientSignal,
          });

          if (!upstream.body) break;
          const reader = upstream.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (aborted) {
              await reader.cancel().catch(() => {});
              break;
            }
            controller.enqueue(value);
          }
        }
      } catch (err) {
        if (!aborted) controller.error(err);
        return;
      } finally {
        clientSignal?.removeEventListener('abort', onAbort);
      }
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, { status: isRange ? 206 : 200, headers: outHeaders });
});

/**
 * GET /api/v1/proxy/hydrax/info/:slug
 * Lists available qualities + direct first-chunk preview link.
 */
hydraxRouter.get('/info/:slug', async (c) => {
  const slug = c.req.param('slug');
  try {
    const ctx = await fetchHydraxMedia(slug);
    const sources = listHydraxSources(ctx);
    return c.json({
      ok: true,
      slug,
      md5_id: ctx.payload.md5_id,
      sources,
      streamUrl: `/api/v1/proxy/hydrax/stream/${slug}`,
    });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 502);
  }
});
