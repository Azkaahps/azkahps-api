import { Hono } from 'hono';
import {
  getHome,
  searchAnime,
  getAnimeDetail,
  getEpisodeStream,
  getQuick,
  getSchedule,
  getBrowse,
  getGenreList
} from './client.js';
import { cache } from '../../../cache.js';
import { CONFIG } from '../../../config.js';
import { successResponse, errorResponse } from '../../../utils/response.js';

export const kuramanimeRouter = new Hono();
const CATEGORY = 'anime';
const PROVIDER = 'kuramanime';

// Recent Updates / Home
kuramanimeRouter.get('/home', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:home`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getHome();
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.HOME);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch anime home' });
  }
});

// Search Anime
kuramanimeRouter.get('/search', async (c) => {
  const query = c.req.query('q') || c.req.query('search') || '';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (!query) {
    return errorResponse(c, {
      category: CATEGORY,
      provider: PROVIDER,
      error: 'Bad Request',
      message: 'Parameter ?q= is required',
      status: 400
    });
  }

  const cacheKey = `${CATEGORY}:${PROVIDER}:search:${query}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await searchAnime(query, page);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.SEARCH);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Anime search failed' });
  }
});

// Ongoing Anime List
kuramanimeRouter.get('/ongoing', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const cacheKey = `${CATEGORY}:${PROVIDER}:ongoing:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getQuick('ongoing', page);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch ongoing anime' });
  }
});

// Anime Movies
kuramanimeRouter.get('/movies', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const cacheKey = `${CATEGORY}:${PROVIDER}:movies:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getQuick('movie', page);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch anime movies' });
  }
});

// Weekly Schedule (per day)
kuramanimeRouter.get('/schedule', async (c) => {
  const day = (c.req.query('day') || 'all').toLowerCase();
  const page = parseInt(c.req.query('page') || '1', 10);
  const cacheKey = `${CATEGORY}:${PROVIDER}:schedule:${day}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getSchedule(day, page);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.SCHEDULE);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch anime schedule' });
  }
});

// Browse with filters (genre / season+year / type / status)
kuramanimeRouter.get('/browse', async (c) => {
  const genre = c.req.query('genre') || '';
  const season = c.req.query('season') || '';
  const year = c.req.query('year') || '';
  const status = c.req.query('status') || '';
  const type = c.req.query('type') || '';
  const orderBy = c.req.query('order_by') || 'updated';
  const page = parseInt(c.req.query('page') || '1', 10);

  const cacheKey = `${CATEGORY}:${PROVIDER}:browse:${genre}:${season}:${year}:${status}:${type}:${orderBy}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getBrowse({ genre, season, year, status, type, orderBy, page });
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to browse anime' });
  }
});

// Genre taxonomy
kuramanimeRouter.get('/genres', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:genres`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getGenreList();
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.DETAIL);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch genres' });
  }
});

// Anime Detail & Episode List
kuramanimeRouter.get('/detail/:id/:slug', async (c) => {
  const id = c.req.param('id');
  const slug = c.req.param('slug');
  const cacheKey = `${CATEGORY}:${PROVIDER}:detail:${id}:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getAnimeDetail(id, slug);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.DETAIL);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch anime detail' });
  }
});

// Stream Video & Download URLs
kuramanimeRouter.get('/stream/:id/:slug/:ep', async (c) => {
  const id = c.req.param('id');
  const slug = c.req.param('slug');
  const ep = c.req.param('ep');
  const server = c.req.query('server') || 'kuramadrive';

  const cacheKey = `${CATEGORY}:${PROVIDER}:stream:${id}:${slug}:${ep}:${server}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await getEpisodeStream(id, slug, ep, server);
    const data = res.data || res;
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.STREAM);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to resolve anime stream' });
  }
});

export const metadata = {
  name: 'Kuramanime',
  category: 'anime',
  slug: 'kuramanime',
  version: '1.0.0',
  description: 'Indonesian anime streaming scraper with multi-resolution MP4 & downloads'
};
