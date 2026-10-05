import { Hono } from 'hono';
import {
  getHome,
  searchContent,
  getMoviesCatalog,
  getSeriesCatalog,
  getByGenre,
  getByCountry,
  getByYear,
  getDetail,
  getStreamUrl
} from './client.js';
import { feedbackRouter } from './feedback.js';
import { cache } from '../../../cache.js';
import { CONFIG } from '../../../config.js';
import { successResponse, errorResponse } from '../../../utils/response.js';

export const lk21Router = new Hono();
const CATEGORY = 'movie';
const PROVIDER = 'lk21';

// Feedback endpoints v2: trending, report, request, reports (admin)
lk21Router.route('/', feedbackRouter);

// Homepage (Latest Movies, Series, Trending)
lk21Router.get('/home', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:home`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getHome();
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.HOME);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch movie home' });
  }
});

// Search Movies & Series
lk21Router.get('/search', async (c) => {
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
    const data = await searchContent(query, page);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.SEARCH);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Movie search failed' });
  }
});

// Movies Catalog
lk21Router.get('/movies', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const sort = c.req.query('sort') || 'latest';

  const cacheKey = `${CATEGORY}:${PROVIDER}:movies:${page}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getMoviesCatalog(page, sort);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch movies catalog' });
  }
});

// Series & Drakor Catalog
lk21Router.get('/series', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const sort = c.req.query('sort') || 'latest-series';

  const cacheKey = `${CATEGORY}:${PROVIDER}:series:${page}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getSeriesCatalog(page, sort);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch series catalog' });
  }
});

// Filter by Genre
lk21Router.get('/genre/:genre', async (c) => {
  const genre = c.req.param('genre');
  const page = parseInt(c.req.query('page') || '1', 10);

  const cacheKey = `${CATEGORY}:${PROVIDER}:genre:${genre}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getByGenre(genre, page);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch genre items' });
  }
});

// Detail Movie / Series
lk21Router.get('/detail/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = `${CATEGORY}:${PROVIDER}:detail:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getDetail(slug);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.DETAIL);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch movie detail' });
  }
});

// Direct Stream Resolver (M3U8)
lk21Router.get('/stream/:server/:id', async (c) => {
  const server = c.req.param('server');
  const id = c.req.param('id');

  const cacheKey = `${CATEGORY}:${PROVIDER}:stream:${server}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const data = await getStreamUrl(server, id);
    cache.set(cacheKey, data, CONFIG.CACHE_TTL.STREAM);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to resolve stream' });
  }
});

export const metadata = {
  name: 'LK21 (Layarkaca21)',
  category: 'movie',
  slug: 'lk21',
  version: '1.0.0',
  description: 'Layarkaca21 and Dramamu movie/series scraper with direct HLS M3U8 resolvers'
};
