import { Hono } from 'hono';
import { fetchIkiruJson, scrapeIkiruChapterHtml, scrapeIkiruSearchAjax } from './client.js';
import { cache } from '../../../cache.js';
import { CONFIG } from '../../../config.js';
import { successResponse, errorResponse } from '../../../utils/response.js';

export const ikiruRouter = new Hono();
const CATEGORY = 'comic';
const PROVIDER = 'ikiru';

// Unified Home
ikiruRouter.get('/home', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:home`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const [popular, latest, projects] = await Promise.all([
      fetchIkiruJson('/home/popular-today').catch(() => ({ data: [] })),
      fetchIkiruJson('/home/latest-updates').catch(() => ({ data: [] })),
      fetchIkiruJson('/home/project-updates').catch(() => ({ data: [] }))
    ]);

    const data = {
      popularToday: popular.data || [],
      latestUpdates: latest.data || [],
      projectUpdates: projects.data || []
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.HOME);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch comic home' });
  }
});

// Latest Catalog (Paginated)
ikiruRouter.get('/latest', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 50);

  const cacheKey = `${CATEGORY}:${PROVIDER}:latest:${page}:${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await fetchIkiruJson(`/list/latest?page=${page}&per_page=${perPage}`);
    const data = {
      pagination: res.pagination,
      items: res.items || []
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch comic latest' });
  }
});

// Search
ikiruRouter.get('/search', async (c) => {
  const q = c.req.query('q') || c.req.query('query') || '';
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 50);
  const type = c.req.query('type') || '';
  const genre = c.req.query('genre') || '';
  const orderby = c.req.query('orderby') || 'relevance';

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('page', page.toString());
  params.set('per_page', perPage.toString());
  if (type) params.set('type', type);
  if (genre) params.set('genre', genre);
  if (orderby) params.set('orderby', orderby);

  const cacheKey = `${CATEGORY}:${PROVIDER}:search:${params.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const [ajaxItems, res] = await Promise.all([
      page === 1 && q ? scrapeIkiruSearchAjax(q).catch(() => []) : Promise.resolve([]),
      fetchIkiruJson(`/search/series?${params.toString()}`)
    ]);

    const seenSlugs = new Set();
    const mergedItems = [];

    // Prioritize high-relevance direct matches
    for (const item of ajaxItems) {
      if (!seenSlugs.has(item.slug)) {
        seenSlugs.add(item.slug);
        mergedItems.push(item);
      }
    }

    // Append catalog items
    for (const item of (res.items || [])) {
      if (!seenSlugs.has(item.slug)) {
        seenSlugs.add(item.slug);
        mergedItems.push(item);
      }
    }

    const data = {
      query: q,
      pagination: {
        page: res.page || page,
        per_page: res.per_page || perPage,
        total: Math.max(res.total || 0, mergedItems.length),
        total_pages: res.total_pages || 1,
        has_next: res.has_next || false
      },
      filters: res.filters || {},
      items: mergedItems
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.SEARCH);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Comic search failed' });
  }
});

// Genres & Taxonomy
ikiruRouter.get('/genres', async (c) => {
  const cacheKey = `${CATEGORY}:${PROVIDER}:genres`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await fetchIkiruJson('/search/filters');

    const typesMap = new Map();
    (res.types || []).forEach((t) => {
      if (t.slug && !typesMap.has(t.slug)) typesMap.set(t.slug, t);
    });

    const rawGenres = res.genres || {};
    const genresMap = new Map();
    const list = Array.isArray(rawGenres) ? rawGenres : Object.values(rawGenres);
    list.forEach((g) => {
      if (g.slug && !genresMap.has(g.slug)) {
        genresMap.set(g.slug, { slug: g.slug, name: g.name || g.slug, count: g.count || 0 });
      }
    });

    const data = {
      types: Array.from(typesMap.values()),
      genres: Array.from(genresMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      orderby: res.orderby || []
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CHAPTER);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch genres' });
  }
});

// Detail Comic by Slug
ikiruRouter.get('/detail/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = `${CATEGORY}:${PROVIDER}:detail:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await fetchIkiruJson(`/series/${encodeURIComponent(slug)}`);
    if (!res.ok || !res.series) {
      return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error: 'Not Found', message: 'Comic not found', status: 404 });
    }

    const data = {
      id: res.series.id,
      title: res.series.title,
      slug: res.series.slug,
      permalink: res.series.permalink,
      cover: res.series.cover,
      rating: res.series.rating,
      views: res.series.views,
      type: res.series.type,
      genres: res.series.genre,
      released: res.series.released,
      description: res.series.description,
      alternative_title: res.series.alternative_title,
      latest_chapters: res.series.latest_chapters || [],
      first_chapter: res.first_chapter || null,
      chapters_meta: {
        total: res.chapters?.total || 0,
        total_pages: res.chapters?.total_pages || 1,
        page: res.chapters?.page || 1,
        items: res.chapters?.items || []
      }
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.DETAIL);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch comic details' });
  }
});

// Full Chapter List by Manga ID
ikiruRouter.get('/chapters/:id', async (c) => {
  const id = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = Math.min(parseInt(c.req.query('per_page') || '100', 10), 200);

  const cacheKey = `${CATEGORY}:${PROVIDER}:chapters:${id}:${page}:${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await fetchIkiruJson(`/series/${id}/chapters?page=${page}&per_page=${perPage}`);
    const data = {
      manga_id: id,
      pagination: {
        page: res.chapters?.page || page,
        per_page: res.chapters?.per_page || perPage,
        total: res.chapters?.total || 0,
        total_pages: res.chapters?.total_pages || 1,
        order: res.chapters?.order || 'desc'
      },
      chapters: res.chapters?.items || []
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CATALOG);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch chapters' });
  }
});

// Chapter Reader Images by Chapter ID
ikiruRouter.get('/chapter/:id', async (c) => {
  const id = c.req.param('id');
  const cacheKey = `${CATEGORY}:${PROVIDER}:chapter:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data: cached, cached: true });
  }

  try {
    const res = await fetchIkiruJson(`/chapter/${id}`);
    if (!res.ok || !res.chapter) {
      return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error: 'Not Found', message: 'Chapter not found', status: 404 });
    }

    const data = {
      chapter: {
        id: res.chapter.id,
        title: res.chapter.title,
        slug: res.chapter.slug,
        manga_id: res.chapter.manga_id,
        number: res.chapter.number,
        number_raw: res.chapter.number_raw
      },
      prev: res.prev,
      next: res.next,
      total_images: res.total_images || res.images?.length || 0,
      images: res.images || []
    };

    cache.set(cacheKey, data, CONFIG.CACHE_TTL.CHAPTER);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Failed to fetch chapter images' });
  }
});

// Fallback HTML Scraper
ikiruRouter.get('/fallback-chapter/:slug/:chapterSlug', async (c) => {
  const slug = c.req.param('slug');
  const chapterSlug = c.req.param('chapterSlug');
  try {
    const data = await scrapeIkiruChapterHtml(slug, chapterSlug);
    return successResponse(c, { category: CATEGORY, provider: PROVIDER, data, cached: false });
  } catch (error) {
    return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error, message: 'Fallback scrape failed' });
  }
});

export const metadata = {
  name: 'Ikiru',
  category: 'comic',
  slug: 'ikiru',
  version: '1.0.0',
  description: 'Manga, manhwa, and manhua reader scraper with direct CDN image URLs'
};
