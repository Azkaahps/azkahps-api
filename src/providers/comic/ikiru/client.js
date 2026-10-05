import { CONFIG } from '../../../config.js';
import * as cheerio from 'cheerio';

const DEFAULT_HEADERS = {
  'User-Agent': CONFIG.USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  Referer: `${CONFIG.UPSTREAMS.IKIRU}/`,
  'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"'
};

export async function fetchIkiruJson(endpoint, options = {}) {
  const url = `${CONFIG.UPSTREAMS.IKIRU}/wp-json/readerkiru/v1${endpoint}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Ikiru upstream HTTP ${response.status}: ${errText.slice(0, 120)}`);
  }

  return response.json();
}

export async function scrapeIkiruChapterHtml(slug, chapterSlug) {
  const url = `${CONFIG.UPSTREAMS.IKIRU}/manga/${slug}/${chapterSlug}/`;
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Ikiru HTML scrape failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const images = [];
  $('section[data-image-data="1"] img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && src.startsWith('http')) {
      images.push({ page: i + 1, url: src });
    }
  });

  return {
    total_images: images.length,
    images
  };
}

let cachedNonce = null;
let nonceExpiry = 0;

export async function scrapeIkiruSearchAjax(query) {
  try {
    if (!cachedNonce || Date.now() > nonceExpiry) {
      const res = await fetch(`${CONFIG.UPSTREAMS.IKIRU}/`, {
        headers: DEFAULT_HEADERS,
        signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
      });
      const html = await res.text();
      const match = html.match(/action=search[&?]nonce=([a-f0-9]+)/i) || html.match(/nonce=([a-f0-9]+)&(?:amp;)?action=search/i);
      cachedNonce = match ? match[1] : '28c92ca5ae';
      nonceExpiry = Date.now() + 6 * 60 * 60 * 1000;
    }

    const url = `${CONFIG.UPSTREAMS.IKIRU}/wp-admin/admin-ajax.php?nonce=${cachedNonce}&action=search`;
    const formData = new URLSearchParams();
    formData.set('query', query);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
    });

    if (!res.ok) return [];
    const html = await res.text();
    if (html.trim() === '-1' || html.trim() === '0') {
      cachedNonce = null;
      return [];
    }

    const $ = cheerio.load(html);
    const items = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || !href.includes('/manga/')) return;
      const slugMatch = href.match(/\/manga\/([^/]+)/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      const title = $(el).find('h3, h4, .title, strong').text().trim() || slug;
      const cover = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      const desc = $(el).find('p').text().trim() || '';

      items.push({
        id: i + 1,
        title,
        slug,
        permalink: href,
        cover,
        description: desc,
        type: ['manhwa']
      });
    });

    return items;
  } catch (err) {
    console.warn('scrapeIkiruSearchAjax error:', err.message);
    return [];
  }
}

