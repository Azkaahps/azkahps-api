import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://v20.kuramanime.ing';
const LEVIATHAN_AUTH = 'kJuHHkaqcBFXiGMHQf6bJw8YAyDcwGD8Ur';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
  Referer: `${BASE_URL}/`,
};

function createSession() {
  return axios.create({
    baseURL: BASE_URL,
    headers: DEFAULT_HEADERS,
    withCredentials: true,
  });
}

function parseAnimeCards($) {
  const list = [];
  $('.product__item').each((_, el) => {
    const titleEl = $(el).find('.product__item__text h5 a');
    const title = titleEl.text().trim();
    const href = titleEl.attr('href') || '';
    const poster = $(el).find('.product__item__pic').attr('data-setbg') || '';
    const type = $(el).find('.product__item__text ul li').first().text().trim();

    // Clean up episode text
    const epRaw = $(el).find('.ep').first().text().trim();
    const epClean = epRaw.split('\n')[0].trim();

    // Parse IDs and slugs
    const match = href.match(/\/anime\/(\d+)\/([^/]+)(?:\/episode\/(\d+))?/);
    if (match) {
      list.push({
        id: match[1],
        slug: match[2],
        title,
        type,
        currentEpisode: match[3] || null,
        episodeInfo: epClean,
        poster,
        href,
        endpoint: `/api/anime/${match[1]}/${match[2]}`,
      });
    }
  });
  return list;
}

/**
 * Scrape Home / Recent Episodes
 */
export async function getHome() {
  const client = createSession();
  const res = await client.get('/');
  const $ = cheerio.load(res.data);
  const animeList = parseAnimeCards($);

  return {
    status: 'success',
    total: animeList.length,
    data: animeList,
  };
}

/**
 * Search Anime
 */
export async function searchAnime(query, page = 1) {
  const client = createSession();
  const res = await client.get('/anime', {
    params: {
      search: query,
      page,
      order_by: 'oldest',
    },
  });
  const $ = cheerio.load(res.data);
  const animeList = parseAnimeCards($);

  return {
    status: 'success',
    query,
    page: parseInt(page),
    total: animeList.length,
    data: animeList,
  };
}

/**
 * Scrape Quick Categories (Ongoing / Movie)
 */
export async function getQuick(type = 'ongoing', page = 1, orderBy = 'updated') {
  const client = createSession();
  const res = await client.get(`/quick/${type}`, {
    params: {
      order_by: orderBy,
      page,
    },
  });
  const $ = cheerio.load(res.data);
  const animeList = parseAnimeCards($);

  return {
    status: 'success',
    category: type,
    page: parseInt(page),
    total: animeList.length,
    data: animeList,
  };
}

/**
 * Scrape Weekly Schedule (per day)
 * Day values: all | monday..sunday (same vocabulary as upstream ?scheduled_day=)
 */
export async function getSchedule(day = 'all', page = 1) {
  const client = createSession();
  const res = await client.get('/schedule', {
    params: {
      scheduled_day: day,
      page,
    },
  });
  const $ = cheerio.load(res.data);
  const list = [];

  $('.product__item').each((_, el) => {
    const titleEl = $(el).find('.product__item__text h5 a');
    const title = titleEl.text().trim();
    const href = titleEl.attr('href') || '';
    const match = href.match(/\/anime\/(\d+)\/([^/]+)/);
    if (!match) return;

    const id = match[1];
    const slug = match[2];
    const poster = $(el).find('.product__item__pic').attr('data-setbg') || '';
    const type = $(el).find('.product__item__text ul li').first().text().trim();

    // Info spans render as [day, airtime] e.g. ["Senin", "04:39 WIB"]
    const infos = [];
    $(el)
      .find('span[class*="actual-schedule-info-"]')
      .each((__, span) => {
        const text = $(span).text().replace(/\s+/g, ' ').trim();
        if (text) infos.push(text);
      });

    // Next episode span renders like "Selanjutnya: Ep 76"
    const epRaw = $(el)
      .find('span[class*="actual-schedule-ep-"]')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const epMatch = epRaw.match(/Ep\s*(\d+)/i);

    list.push({
      id,
      slug,
      title,
      type,
      poster,
      day: infos[0] || null,
      airtime: infos[1] || null,
      nextEpisode: epMatch ? parseInt(epMatch[1], 10) : null,
      href,
      endpoint: `/api/anime/${id}/${slug}`,
    });
  });

  return {
    status: 'success',
    day,
    page: parseInt(page, 10),
    total: list.length,
    data: list,
  };
}

/**
 * Browse with filters.
 * Upstream filter routes are path-based (NOT query-based):
 *   - /properties/genre/{slug}
 *   - /properties/season/{season}-{year}
 *   - /properties/type/{lowercase}?name={ProperCase}
 *   - /quick/{ongoing|finished|upcoming|movie}
 * The generic /anime?genre=... endpoint IGNORES query filters (they are JS-driven),
 * so always route through the path-based endpoints above.
 */
export async function getBrowse({ genre, season, year, status, type, orderBy = 'updated', page = 1 } = {}) {
  let path;
  let params = { order_by: orderBy, page };

  if (genre) {
    path = `/properties/genre/${genre}`;
  } else if (season && year) {
    path = `/properties/season/${season}-${year}`;
  } else if (type) {
    // Upstream redirects /properties/type/{X} -> /properties/type/{lower}?name={X}
    const lower = type.toLowerCase();
    const proper = type.toUpperCase() === type ? type : type.charAt(0).toUpperCase() + type.slice(1);
    path = `/properties/type/${lower}`;
    params = { ...params, name: proper, order_by: 'ascending' };
  } else if (status === 'finished') {
    path = '/quick/finished';
  } else if (status === 'upcoming') {
    path = '/quick/upcoming';
  } else if (status === 'ongoing') {
    path = '/quick/ongoing';
  } else if (year) {
    // Year-only: upstream has no year-only route. Use the current season of
    // that year so the filter still applies instead of silently returning
    // the unfiltered alphabetical listing.
    path = `/properties/season/${currentSeason()}-${year}`;
  } else {
    path = '/anime';
  }

  const client = createSession();
  const res = await client.get(path, { params });
  const $ = cheerio.load(res.data);
  const animeList = parseAnimeCards($);

  return {
    status: 'success',
    path,
    page: parseInt(page, 10),
    total: animeList.length,
    data: animeList,
  };
}

/** Current season keyword based on the calendar month. */
function currentSeason() {
  const m = new Date().getMonth(); // 0-11
  if (m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

/**
 * Genre taxonomy - scrape the /properties/genre index page.
 */
export async function getGenreList() {
  const client = createSession();
  const res = await client.get('/properties/genre');
  const $ = cheerio.load(res.data);
  const genres = [];
  const seen = new Set();

  $('a[href*="/properties/genre/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/properties\/genre\/([^?/]+)/);
    if (!match) return;
    const slug = match[1];
    if (seen.has(slug)) return;
    seen.add(slug);
    const name = $(el).text().replace(/\s+/g, ' ').trim();
    if (!name) return;
    genres.push({ slug, name });
  });

  genres.sort((a, b) => a.name.localeCompare(b.name));

  return {
    status: 'success',
    total: genres.length,
    data: genres,
  };
}

/**
 * Scrape Anime Detail
 */
export async function getAnimeDetail(id, slug) {
  const client = createSession();
  const res = await client.get(`/anime/${id}/${slug}`);
  const $ = cheerio.load(res.data);

  const title = $('.anime__details__title h3').text().trim();
  const synonyms = $('.anime__details__title span').first().text().trim();
  const poster = $('.anime__details__pic').attr('data-setbg') || '';
  const synopsis = $('#synopsisField').text().trim();

  const metadata = {};
  $('.anime__details__widget ul li').each((_, el) => {
    const key = $(el).find('span').first().text().replace(':', '').trim();
    const val = $(el).find('.col-9, .col-lg-9').text().trim();
    if (key && val) {
      metadata[key.toLowerCase()] = val.replace(/\s+/g, ' ');
    }
  });

  // Extract episode list from popover
  const epPopover = $('#episodeLists').attr('data-content') || '';
  const $ep = cheerio.load(epPopover);
  const episodes = [];

  $ep('a').each((_, el) => {
    const epHref = $ep(el).attr('href') || '';
    const m = epHref.match(/\/episode\/(\d+)/);
    if (m) {
      const epNum = parseInt(m[1]);
      episodes.push({
        episode: epNum,
        title: `Episode ${epNum}`,
        href: epHref,
        streamEndpoint: `/api/anime/${id}/${slug}/episode/${epNum}`,
      });
    }
  });

  return {
    status: 'success',
    data: {
      id,
      slug,
      title,
      synonyms,
      poster,
      synopsis,
      type: metadata['tipe'] || null,
      episodesTotal: metadata['episode'] || null,
      status: metadata['status'] || null,
      aired: metadata['tayang'] || null,
      season: metadata['musim'] || null,
      duration: metadata['durasi'] || null,
      quality: metadata['kualitas'] || null,
      genres: metadata['genre'] ? metadata['genre'].split(',').map((g) => g.trim()) : [],
      studio: metadata['studio'] || null,
      score: metadata['skor'] || null,
      rating: metadata['rating'] || null,
      episodes,
    },
  };
}

/**
 * Reverse Engineer Stream Player & Download Links for an Episode
 */
export async function getEpisodeStream(id, slug, episodeNum, server = 'kuramadrive') {
  const client = createSession();
  const epPath = `/anime/${id}/${slug}/episode/${episodeNum}`;

  // 1. Initial Page Load
  const pageRes = await client.get(epPath);
  const rawCookies = pageRes.headers['set-cookie'] || [];
  const cookieString =
    rawCookies.map((c) => c.split(';')[0]).join('; ') +
    '; preferred_stserver=' +
    server;

  const matchKk = pageRes.data.match(/data-kk="([^"]+)"/);
  if (!matchKk) {
    throw new Error('Gagal mendeteksi token proteksi halaman (data-kk tidak ditemukan)');
  }
  const dataKk = matchKk[1];

  // 2. Fetch auth JS variables
  const jsRes = await client.get(`/assets/js/${dataKk}.js`);
  const prefix = jsRes.data.match(/MIX_PREFIX_AUTH_ROUTE_PARAM:\s*'([^']+)'/)?.[1] || 'assets/';
  const authRoute = jsRes.data.match(/MIX_AUTH_ROUTE_PARAM:\s*'([^']+)'/)?.[1];
  const authKey = jsRes.data.match(/MIX_AUTH_KEY:\s*'([^']+)'/)?.[1];
  const authToken = jsRes.data.match(/MIX_AUTH_TOKEN:\s*'([^']+)'/)?.[1];
  const pageTokenKey = jsRes.data.match(/MIX_PAGE_TOKEN_KEY:\s*'([^']+)'/)?.[1];
  const streamServerKey = jsRes.data.match(/MIX_STREAM_SERVER_KEY:\s*'([^']+)'/)?.[1];

  if (!authRoute || !authKey || !authToken || !pageTokenKey || !streamServerKey) {
    throw new Error('Gagal mengekstrak konfigurasi auth dinamis dari script');
  }

  // 3. Check Episode Page Number
  let pageNum = '1';
  try {
    const checkRes = await client.get(`/anime/${id}/episode/${episodeNum}/check-episode`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieString,
      },
    });
    if (checkRes.data) {
      pageNum = String(checkRes.data).replace(/"/g, '').trim();
    }
  } catch (e) {
    // fallback page 1
  }

  // 4. Request Page Access Token
  const tokenRes = await client.get(`/${prefix}${authRoute}`, {
    headers: {
      'X-Fuck-ID': `${authKey}:${authToken}`,
      'X-Request-ID': Math.random().toString(36).substring(2, 8),
      'X-Request-Index': '0',
      Cookie: cookieString,
    },
  });
  const pageToken = tokenRes.data.trim();

  // 5. POST Request to unlock streaming & download links
  const targetUrl = `${epPath}?${pageTokenKey}=${pageToken}&${streamServerKey}=${server}&page=${pageNum}`;

  const postHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: BASE_URL,
    Referer: `${BASE_URL}${epPath}`,
    Cookie: cookieString,
  };

  const unlockRes = await client.post(
    targetUrl,
    new URLSearchParams({ authorization: LEVIATHAN_AUTH }).toString(),
    { headers: postHeaders }
  );

  const $ = cheerio.load(unlockRes.data);

  // 6. Extract Direct Video Sources
  const streamSources = [];
  $('video#player source').each((_, el) => {
    const src = $(el).attr('src');
    const size = $(el).attr('size') || $(el).attr('id')?.replace('source', '') || 'unknown';
    const type = $(el).attr('type') || 'video/mp4';
    if (src) {
      streamSources.push({
        quality: `${size}p`,
        url: src,
        type,
      });
    }
  });

  // 7. Extract Download Links
  const downloads = [];
  let currentGroup = null;

  $('#animeDownloadLink')
    .children()
    .each((_, el) => {
      const tagName = el.tagName?.toLowerCase();
      if (tagName === 'h6') {
        const title = $(el).text().trim();
        currentGroup = {
          format: title,
          links: [],
        };
        downloads.push(currentGroup);
      } else if (tagName === 'a' && currentGroup) {
        const dlHref = $(el).attr('href');
        const dlText = $(el).text().trim();
        if (dlHref && !dlHref.startsWith('javascript:')) {
          currentGroup.links.push({
            server: dlText,
            url: dlHref,
          });
        }
      }
    });

  return {
    status: 'success',
    animeId: id,
    slug,
    episode: parseInt(episodeNum),
    server,
    stream: {
      hasDirectStream: streamSources.length > 0,
      sources: streamSources,
    },
    downloads,
  };
}
