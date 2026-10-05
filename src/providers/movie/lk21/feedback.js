import { Hono } from 'hono';
import { cache } from '../../../cache.js';
import { CONFIG } from '../../../config.js';
import { successResponse, errorResponse } from '../../../utils/response.js';
import { getHome, getMoviesCatalog } from './client.js';

/**
 * Endpoint improvisasi v2 untuk AzkaHPS Stream:
 * - GET  /trending      : rail trending (gabungan top bulan ini + katalog populer, dedup)
 * - POST /report        : laporan stream rusak dari player
 * - POST /request       : request judul baru dari halaman /request
 * - GET  /reports       : daftar laporan (buat admin, protected dengan token sederhana)
 *
 * Laporan & request disimpan di memori (ring buffer) — cukup untuk volume
 * personal, hilang saat restart. Kalau nanti perlu persisten, pindah ke file
 * JSON atau D1.
 */

export const feedbackRouter = new Hono();
const CATEGORY = 'movie';
const PROVIDER = 'lk21';

/* ---------- In-memory ring buffers ---------- */

const MAX_ENTRIES = 500;
const streamReports = [];
const movieRequests = [];

function pushBounded(list, entry) {
  list.unshift(entry);
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
}

/* ---------- GET /trending ---------- */

feedbackRouter.get('/trending', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:trending`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: { items: cached }, cached: true });
  }

  try {
    // Gabung beberapa sumber, dedup by slug, pertahankan urutan prioritas
    const [home, popular] = await Promise.allSettled([
      getHome(),
      getMoviesCatalog(1, 'populer')
    ]);

    const seen = new Set();
    const items = [];

    const add = (list) => {
      for (const item of list || []) {
        if (!item?.slug || seen.has(item.slug)) continue;
        seen.add(item.slug);
        items.push(item);
      }
    };

    if (home.status === 'fulfilled') {
      add(home.value.topOfMonth);
      add(home.value.recommended);
      add(home.value.latestMovies);
    }
    if (popular.status === 'fulfilled') {
      add(popular.value.items);
    }

    const result = items.slice(0, 30);
    cache.set(cacheKey, result, CONFIG.CACHE_TTL.HOME);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: { items: result }, cached: false });
  } catch (error) {
    return errorResponse(c, {
      category: CATEGORY,
      provider: PROVIDER,
      error,
      message: 'Failed to build trending rail'
    });
  }
});

/* ---------- POST /report ---------- */

const VALID_REASONS = new Set(['broken', 'buffering', 'no-audio', 'no-subtitle', 'wrong-content', 'other']);

feedbackRouter.post('/report', async (c) => {
  try {
    const body = await c.req.json();
    const slug = String(body.slug || '').trim().slice(0, 200);
    const title = String(body.title || '').trim().slice(0, 300);
    const server = String(body.server || '').trim().slice(0, 40);
    const reason = String(body.reason || '').trim();

    if (!slug || !reason || !VALID_REASONS.has(reason)) {
      return errorResponse(c, {
        category: CATEGORY,
        provider: PROVIDER,
        error: 'Bad Request',
        message: 'slug dan reason (valid) wajib diisi',
        status: 400
      });
    }

    const entry = {
      id: `rep_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      slug,
      title,
      server,
      streamId: String(body.streamId || '').slice(0, 100),
      reason,
      note: String(body.note || '').slice(0, 500),
      at: new Date().toISOString()
    };
    pushBounded(streamReports, entry);

    console.log(`[STREAM REPORT] ${slug} (${server}) — ${reason}${entry.note ? ` — ${entry.note}` : ''}`);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: { received: true, id: entry.id } });
  } catch (error) {
    return errorResponse(c, {
      category: CATEGORY,
      provider: PROVIDER,
      error,
      message: 'Failed to record stream report',
      status: 400
    });
  }
});

/* ---------- POST /request ---------- */

feedbackRouter.post('/request', async (c) => {
  try {
    const body = await c.req.json();
    const title = String(body.title || '').trim().slice(0, 300);

    if (!title) {
      return errorResponse(c, {
        category: CATEGORY,
        provider: PROVIDER,
        error: 'Bad Request',
        message: 'title wajib diisi',
        status: 400
      });
    }

    const entry = {
      id: `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title,
      type: ['movie', 'series'].includes(body.type) ? body.type : 'movie',
      year: Number.isFinite(Number(body.year)) ? Number(body.year) : null,
      note: String(body.note || '').slice(0, 500),
      contact: String(body.contact || '').slice(0, 200),
      at: new Date().toISOString()
    };
    pushBounded(movieRequests, entry);

    console.log(`[MOVIE REQUEST] ${title} (${entry.type}${entry.year ? `, ${entry.year}` : ''})`);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: { received: true, id: entry.id } });
  } catch (error) {
    return errorResponse(c, {
      category: CATEGORY,
      provider: PROVIDER,
      error,
      message: 'Failed to record movie request',
      status: 400
    });
  }
});

/* ---------- GET /reports (admin) ---------- */

feedbackRouter.get('/reports', (c) => {
  const token = c.req.query('token') || c.req.header('x-admin-token');
  const expected = process.env.ADMIN_TOKEN;

  // Tanpa ADMIN_TOKEN di env: endpoint tetap jalan (personal use), tapi
  // kalau token di-set, wajib cocok.
  if (expected && token !== expected) {
    return errorResponse(c, {
      category: CATEGORY,
      provider: PROVIDER,
      error: 'Unauthorized',
      message: 'Token admin tidak valid',
      status: 401
    });
  }

  return successResponse(c, {
    category: CATEGORY,
    provider: PROVIDER,
    data: {
      streamReports: streamReports.slice(0, 100),
      movieRequests: movieRequests.slice(0, 100),
      counts: { reports: streamReports.length, requests: movieRequests.length }
    }
  });
});
