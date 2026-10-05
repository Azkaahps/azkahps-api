import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fetchHydraxMedia, listHydraxSources } from './hydrax.js';
import { resolveCastStream } from './cast.js';

const execFileAsync = promisify(execFile);

const LK21_BASE_URL = 'https://tv12.lk21official.cc';
const DRAMA_BASE_URL = 'https://dramamu.lk21.de';
const SEARCH_API_URL = 'https://gudangvape.com/search.php';
const POSTER_BASE_URL = 'https://poster.assetsy.de/wp-content/uploads/';
const VIDEONODE_API_URL = 'https://videonode.de/api.php';
const PLAYCDN_VERIFY_URL = 'https://playcdn.de/verify/';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
};

/**
 * Format relative/partial poster URL to absolute URL
 */
function normalizePosterUrl(poster) {
  if (!poster) return '';
  if (poster.startsWith('http://') || poster.startsWith('https://')) {
    return poster;
  }
  return `${POSTER_BASE_URL}${poster.replace(/^\//, '')}`;
}

/**
 * Clean and parse catalog items from Cheerio DOM
 */
function parseCatalogArticles($) {
  const items = [];

  $('article[itemscope]').each((_, el) => {
    const article = $(el);
    const linkEl = article.find('figure a').first();
    const rawHref = linkEl.attr('href') || '';
    const slug = rawHref.replace(/^\//, '').replace(/\/$/, '');

    const title = article.find('.poster-title').text().trim() || linkEl.attr('title') || '';
    const rating = article.find('.rating span[itemprop="ratingValue"]').text().trim() || article.find('.rating').text().trim();
    const year = article.find('.year').text().trim();
    const quality = article.find('[class*="label-"]').text().trim() || article.find('.label').text().trim();
    const duration = article.find('.duration').text().trim();
    const genre = article.find('.genre').text().trim() || article.find('meta[itemprop="genre"]').attr('content') || '';
    const episode = article.find('.episode strong').text().trim() || article.find('.episode').text().trim();

    // Poster parsing
    let poster = '';
    const sourceWebp = article.find('picture source[type="image/webp"]').attr('srcset') || article.find('picture source[type="image/webp"]').attr('data-srcset');
    const sourceJpg = article.find('picture source[type="image/jpeg"]').attr('srcset') || article.find('picture source[type="image/jpeg"]').attr('data-srcset');
    const imgTag = article.find('img');
    const imgSrc = imgTag.attr('data-src') || imgTag.attr('src') || imgTag.attr('data-lazy-src') || '';

    poster = sourceWebp || sourceJpg || imgSrc;

    if (slug) {
      items.push({
        title,
        slug,
        rating: rating ? parseFloat(rating) || rating : null,
        year: year ? parseInt(year, 10) || year : null,
        quality: quality || null,
        duration: duration || null,
        episode: episode || null,
        genre: genre || null,
        poster: normalizePosterUrl(poster),
        url: `${LK21_BASE_URL}/${slug}`,
      });
    }
  });

  // Extract pagination
  let totalPages = 1;
  let currentPage = 1;
  const paginationLinks = $('.pagination li a');
  paginationLinks.each((_, el) => {
    const pageNum = parseInt($(el).text().trim(), 10);
    if (!isNaN(pageNum) && pageNum > totalPages) {
      totalPages = pageNum;
    }
  });

  const activePage = $('.pagination li.active a').text().trim();
  if (activePage && !isNaN(parseInt(activePage, 10))) {
    currentPage = parseInt(activePage, 10);
  }

  return {
    items,
    pagination: {
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    },
  };
}

/**
 * GET HOMEPAGE SECTIONS
 * (Film Terbaru, Series Unggulan, Series Update, Top Bulan Ini, Rekomendasi, Drakor, dll.)
 */
export async function getHome() {
  const res = await axios.get(LK21_BASE_URL, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);

  function parseSectionArticles(container) {
    const items = [];
    $(container).find('article').each((_, el) => {
      const article = $(el);
      const linkEl = article.find('figure a').first();
      const rawHref = linkEl.attr('href') || '';
      const slug = rawHref.replace(/^\//, '').replace(/\/$/, '');

      const title = article.find('.poster-title').text().trim() || linkEl.attr('title') || '';
      const rating = article.find('.rating span[itemprop="ratingValue"]').text().trim() || article.find('.rating').text().trim();
      const year = article.find('.year').text().trim();
      const quality = article.find('[class*="label-"]').text().trim() || article.find('.label').text().trim();
      const duration = article.find('.duration').text().trim();
      const genre = article.find('.genre').text().trim() || article.find('meta[itemprop="genre"]').attr('content') || '';
      const episode = article.find('.episode strong').text().trim() || article.find('.episode').text().trim();

      let poster = '';
      const sourceWebp = article.find('picture source[type="image/webp"]').attr('srcset') || article.find('picture source[type="image/webp"]').attr('data-srcset');
      const sourceJpg = article.find('picture source[type="image/jpeg"]').attr('srcset') || article.find('picture source[type="image/jpeg"]').attr('data-srcset');
      const imgTag = article.find('img');
      const imgSrc = imgTag.attr('data-src') || imgTag.attr('src') || '';
      poster = sourceWebp || sourceJpg || imgSrc;

      if (slug) {
        items.push({
          title,
          slug,
          rating: rating ? parseFloat(rating) || rating : null,
          year: year ? parseInt(year, 10) || year : null,
          quality: quality || null,
          duration: duration || null,
          episode: episode || null,
          genre: genre || null,
          poster: normalizePosterUrl(poster),
          type: slug.includes('season-') || episode ? 'series' : 'movie',
          url: `${LK21_BASE_URL}/${slug}`,
        });
      }
    });
    return items;
  }

  function getSection(regex) {
    let result = [];
    $('section, .widget').each((_, el) => {
      const h = $(el).find('h2, .header h2, .widget-title').first().text().trim();
      if (regex.test(h) && result.length === 0) {
        result = parseSectionArticles(el);
      }
    });
    return result;
  }

  return {
    latestMovies: getSection(/Film Terbaru/i),
    featuredSeries: getSection(/Series Unggulan/i),
    seriesUpdates: getSection(/Series Update/i),
    topOfMonth: getSection(/Top Bulan Ini/i),
    recommended: getSection(/Rekomendasi Untukmu/i),
    drakor: getSection(/Maraton Drakor/i),
    action: getSection(/Action Terbaru/i),
    horror: getSection(/Horror Terbaru/i),
  };
}

/**
 * 1. SEARCH CONTENT (Movies & Series) via pure JSON API
 */
export async function searchContent(query, page = 1) {
  if (!query) throw new Error('Query parameter is required');

  const res = await axios.get(SEARCH_API_URL, {
    params: { s: query, page },
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const rawData = res.data;
  const rawItems = rawData.data || rawData.items || [];
  const totalPages = Number(rawData.totalPages || rawData.total_pages || 1);

  const items = rawItems.map((item) => ({
    id: item.id || null,
    title: (item.title || '').replace(/\(\d{4}\)$/, '').trim(),
    slug: item.slug || '',
    type: item.type || 'movie',
    year: item.year || null,
    rating: item.rating ? parseFloat(item.rating) : null,
    quality: item.quality || null,
    runtime: item.runtime || null,
    season: item.season || null,
    episode: item.episode || null,
    isComplete: item.is_complete === 1,
    poster: normalizePosterUrl(item.poster),
    url:
      item.type === 'series'
        ? `${DRAMA_BASE_URL}/${item.slug}`
        : `${LK21_BASE_URL}/${item.slug}`,
  }));

  return {
    query,
    page: Number(page),
    totalPages,
    totalItems: items.length,
    items,
  };
}

/**
 * 2. GET MOVIES CATALOG
 * sort: 'latest', 'populer', 'rating', 'release'
 */
export async function getMoviesCatalog(page = 1, sort = 'latest') {
  const validSorts = ['latest', 'populer', 'rating', 'release'];
  const activeSort = validSorts.includes(sort) ? sort : 'latest';
  const targetUrl = `${LK21_BASE_URL}/${activeSort}/page/${page}`;

  const res = await axios.get(targetUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const result = parseCatalogArticles($);

  return {
    category: 'movies',
    sort: activeSort,
    page: Number(page),
    ...result,
  };
}

/**
 * 3. GET SERIES CATALOG
 * sort: 'latest-series', 'series/ongoing', 'series/complete', 'series/asian', 'series/west'
 */
export async function getSeriesCatalog(page = 1, sort = 'latest-series') {
  let targetUrl = '';
  if (sort.startsWith('series/')) {
    targetUrl = `${DRAMA_BASE_URL}/${sort}/page/${page}`;
  } else {
    targetUrl = `${DRAMA_BASE_URL}/${sort || 'latest-series'}/page/${page}`;
  }

  const res = await axios.get(targetUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${DRAMA_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const result = parseCatalogArticles($);

  return {
    category: 'series',
    sort,
    page: Number(page),
    ...result,
  };
}

/**
 * 4. GET BY GENRE
 */
export async function getByGenre(genre, page = 1) {
  const targetUrl = `${LK21_BASE_URL}/genre/${encodeURIComponent(genre)}/page/${page}`;

  const res = await axios.get(targetUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const result = parseCatalogArticles($);

  return {
    filter: 'genre',
    value: genre,
    page: Number(page),
    ...result,
  };
}

/**
 * 5. GET BY COUNTRY
 */
export async function getByCountry(country, page = 1) {
  const targetUrl = `${LK21_BASE_URL}/country/${encodeURIComponent(country)}/page/${page}`;

  const res = await axios.get(targetUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const result = parseCatalogArticles($);

  return {
    filter: 'country',
    value: country,
    page: Number(page),
    ...result,
  };
}

/**
 * 6. GET BY YEAR
 */
export async function getByYear(year, page = 1) {
  const targetUrl = `${LK21_BASE_URL}/year/${encodeURIComponent(year)}/page/${page}`;

  const res = await axios.get(targetUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Referer: `${LK21_BASE_URL}/`,
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  const result = parseCatalogArticles($);

  return {
    filter: 'year',
    value: year,
    page: Number(page),
    ...result,
  };
}

/**
 * 7. GET DETAIL (Movie, Series, or Episode)
 */
export async function getDetail(slug) {
  if (!slug) throw new Error('Slug parameter is required');

  const cleanSlug = slug.replace(/^\//, '').replace(/\/$/, '');

  let isSeries = false;
  let isEpisode = false;
  let html = '';
  let finalBaseUrl = LK21_BASE_URL;

  // Try fetching movie page first
  try {
    const movieResp = await axios.get(`${LK21_BASE_URL}/${cleanSlug}`, {
      headers: {
        ...DEFAULT_HEADERS,
        Referer: `${LK21_BASE_URL}/`,
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    html = movieResp.data;

    // Check if it redirected to nontondrama bridge
    if (html.includes('Anda akan dialihkan ke') || html.includes('dramamu.lk21.de')) {
      isSeries = true;
    }
  } catch (err) {
    if (err.response?.status === 404) {
      isSeries = true;
    } else {
      throw err;
    }
  }

  // If identified as series or drama bridge, fetch from dramamu.lk21.de
  if (isSeries) {
    finalBaseUrl = DRAMA_BASE_URL;
    const dramaResp = await axios.get(`${DRAMA_BASE_URL}/${cleanSlug}`, {
      headers: {
        ...DEFAULT_HEADERS,
        Referer: `${DRAMA_BASE_URL}/`,
      },
      timeout: 10000,
    });
    html = dramaResp.data;
  }

  const $ = cheerio.load(html);

  // Check if this is an Episode detail page
  if (cleanSlug.includes('-season-') && cleanSlug.includes('-episode-')) {
    isEpisode = true;
  }

  // Parse Player Select Options
  const players = [];
  $('#player-select option, .player-select option, select[aria-label*="Player"] option').each((_, el) => {
    const opt = $(el);
    const rawVal = opt.attr('value') || '';
    const server = opt.attr('data-server') || '';
    const label = opt.text().trim();

    if (rawVal && rawVal.includes('videonode.de')) {
      const parts = rawVal.split('/');
      const id = parts[parts.length - 1].split('?')[0];
      const srv = server || parts[parts.length - 2];

      players.push({
        name: label,
        server: srv,
        id,
        embedUrl: rawVal,
        recommended: srv === 'p2p' || srv === 'turbovip',
      });
    }
  });

  // Fallback: Check iframe#main-player or any iframe with videonode.de
  if (players.length === 0) {
    const mainIframeSrc = $('iframe#main-player').attr('src') || $('iframe[src*="videonode.de"]').first().attr('src');
    if (mainIframeSrc && mainIframeSrc.includes('videonode.de')) {
      const parts = mainIframeSrc.split('/');
      const id = parts[parts.length - 1].split('?')[0];
      const srv = parts[parts.length - 2] || 'p2p';
      players.push({
        name: `Default Player (${srv.toUpperCase()})`,
        server: srv,
        id,
        embedUrl: mainIframeSrc,
        recommended: true,
      });
    }
  }

  // Basic Info
  const title = $('h1').first().text().trim() || $('title').text().replace(/ \|.*$/, '').trim();
  const ratingText = $('.rating-number').text().trim() || $('.rating-score').text().trim() || $('.rating').first().text().trim();
  const rating = parseFloat(ratingText) || null;
  const votes = $('.rating-users').text().trim() || null;

  // Synopsis
  let synopsis = $('.synopsis').text().trim() || $('blockquote').text().trim() || '';
  synopsis = synopsis.replace(/\s+/g, ' ').replace(/Perhatian Sebelum Berkomentar:.*$/, '').trim();

  // Poster
  let poster = '';
  const metaPoster = $('meta[property="og:image"]').attr('content');
  const posterImg = $('.movie-info img, .detail img, .player-area img').first();
  poster = metaPoster || posterImg.attr('data-src') || posterImg.attr('src') || '';
  poster = normalizePosterUrl(poster);

  // Metadata tags
  const genres = [];
  $('a[href*="/genre/"]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  const countries = [];
  $('a[href*="/country/"]').each((_, el) => {
    const c = $(el).text().trim();
    if (c && !countries.includes(c)) countries.push(c);
  });

  const directors = [];
  $('a[href*="/director/"]').each((_, el) => {
    const d = $(el).text().trim();
    if (d && !directors.includes(d)) directors.push(d);
  });

  const cast = [];
  $('a[href*="/artist/"]').each((_, el) => {
    const a = $(el).text().trim();
    if (a && !cast.includes(a)) cast.push(a);
  });

  const release = $('p:contains("Release:"), span:contains("Release:")').text().replace(/.*Release:\s*/i, '').trim() || null;

  // Download URL (if available)
  const downloadBtn = $('a[href*="dadadidi.de"]').attr('href') || null;

  // If Series: Parse embedded Seasons & Episodes JSON
  let seasons = [];
  if (isSeries && !isEpisode) {
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';
      const jsonMatch = scriptText.match(/(\{"\d+":\s*\[\s*\{.*?\}\s*\]\s*\})/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          seasons = Object.keys(parsed).map((seasonNum) => ({
            season: parseInt(seasonNum, 10),
            episodes: parsed[seasonNum].map((ep) => ({
              episodeNumber: ep.episode_no,
              title: ep.title,
              slug: ep.slug,
              detailUrl: `/api/detail/${ep.slug}`,
            })),
          }));
        } catch (_) {}
      }
    });
  }

  return {
    title,
    slug: cleanSlug,
    type: isEpisode ? 'episode' : isSeries ? 'series' : 'movie',
    rating,
    votes,
    synopsis,
    poster,
    genres,
    countries,
    directors,
    cast,
    release,
    downloadUrl: downloadBtn,
    players,
    seasons: seasons.length > 0 ? seasons : undefined,
  };
}

/**
 * Call videonode.de API with Cloudflare bypass (curl + python fallback)
 */
async function callVideonodeApi(server, id) {
  // Method 1: Try curl with explicit headers
  try {
    const curlArgs = [
      '-s',
      '-X', 'POST',
      VIDEONODE_API_URL,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-H', `Referer: https://videonode.de/iframe3/${server}/${id}?v=1`,
      '-H', 'Origin: https://videonode.de',
      '-H', 'Content-Type: application/x-www-form-urlencoded',
      '-H', 'X-Requested-With: XMLHttpRequest',
      '-H', 'Accept: */*',
      '-d', `host=${encodeURIComponent(server)}&id=${encodeURIComponent(id)}`
    ];

    const { stdout } = await execFileAsync('curl', curlArgs, { timeout: 8000 });
    const trimmed = (stdout || '').trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.embedUrl) return parsed.embedUrl;
    }
  } catch (_) {}

  // Method 2: Fallback to Python urllib (never blocked by Cloudflare WAF on Linux/Windows)
  try {
    const pyCode = `
import urllib.request, urllib.parse, json
data = urllib.parse.urlencode({'host': '${server}', 'id': '${id}'}).encode()
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://videonode.de/iframe3/${server}/${id}?v=1',
    'Origin': 'https://videonode.de',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest'
}
req = urllib.request.Request('${VIDEONODE_API_URL}', data=data, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    print(resp.read().decode())
`;
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout } = await execFileAsync(pythonCmd, ['-c', pyCode], { timeout: 12000 });
    const parsed = JSON.parse(stdout.trim());
    if (parsed.embedUrl) return parsed.embedUrl;
  } catch (pyErr) {
    throw new Error(`Gagal menghubungi videonode.de via curl & python (${pyErr.message})`);
  }

  throw new Error(`Gagal mendapatkan embed URL dari server '${server}' (ID: ${id})`);
}

/**
 * 8. RESOLVE STREAM URL (to direct M3U8 or provider embed)
 * Supports:
 * - p2p (PlayCDN -> direct .m3u8)
 * - turbovip (TurbovidHLS -> direct .m3u8)
 * - hydrax (AbyssPlayer -> proprietary embed)
 */
export async function getStreamUrl(server = 'p2p', id) {
  if (!id) throw new Error('ID player video diperlukan');

  const rawEmbedUrl = await callVideonodeApi(server, id);

  // Case A: P2P (PlayCDN HLS stream)
  if (server === 'p2p' || rawEmbedUrl.includes('playcdn.de')) {
    const slug = rawEmbedUrl.replace(/\/$/, '').split('/').pop();
    const verifyUrl = `${PLAYCDN_VERIFY_URL}${encodeURIComponent(slug)}`;

    const step2Resp = await axios.get(verifyUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Referer: rawEmbedUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 10000,
    });

    const streamData = step2Resp.data;
    if (streamData.status !== 'success' || !streamData.fileUrl) {
      throw new Error(streamData.message || 'Stream URL tidak ditemukan di server PlayCDN.');
    }

    return {
      server,
      id,
      provider: 'playcdn',
      streamType: 'hls',
      title: streamData.title || '',
      poster: streamData.poster || '',
      fileUrl: streamData.fileUrl,
      streamProxy: `/api/v1/proxy/hls?url=${encodeURIComponent(streamData.fileUrl)}`,
    };
  }

  // Case B: TURBOVIP (TurbovidHLS direct M3U8)
  if (server === 'turbovip' || rawEmbedUrl.includes('emturbovid.com') || rawEmbedUrl.includes('turbovidhls.com')) {
    const turbovipResp = await axios.get(rawEmbedUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Referer: 'https://videonode.de/',
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const html = turbovipResp.data;
    const hashMatch = html.match(/data-hash=["']([^"']+\.m3u8)["']/) || html.match(/urlPlay\s*=\s*["']([^"']+\.m3u8)["']/);
    
    if (hashMatch) {
      const playlistUrl = hashMatch[1];
      const finalHost = turbovipResp.request?.res?.responseUrl || 'https://turbovidhls.com/';
      
      const m3u8Resp = await axios.get(playlistUrl, {
        headers: {
          ...DEFAULT_HEADERS,
          Referer: finalHost,
        },
        timeout: 10000,
      });

      const lines = m3u8Resp.data.trim().split('\n');
      const masterUrl = lines.find((l) => l.startsWith('http')) || playlistUrl;

      return {
        server,
        id,
        provider: 'turbovid',
        streamType: 'hls',
        title: '',
        poster: '',
        fileUrl: masterUrl,
        streamProxy: `/api/v1/proxy/hls?url=${encodeURIComponent(masterUrl)}`,
      };
    }
  }

  // Case C: CAST (mfw09.org "Byse" player -> captcha PoW -> AES-GCM playback -> HLS)
  // Domain can rotate (mfw09 -> mfw10...), so match the family, not one host.
  if (server === 'cast' || /(?:^|\/\/)mfw\d+\./.test(rawEmbedUrl) || /\/e\/[A-Za-z0-9_-]+$/.test(rawEmbedUrl)) {
    const code = rawEmbedUrl.replace(/\/$/, '').split('/').pop();
    const castBase = (() => {
      try {
        return new URL(rawEmbedUrl).origin;
      } catch {
        return undefined; // fall back to default CAST_BASE inside the resolver
      }
    })();
    const cast = await resolveCastStream(code, castBase);

    return {
      server,
      id,
      provider: 'cast',
      streamType: 'hls',
      title: '',
      poster: cast.posterUrl || '',
      fileUrl: cast.m3u8,
      sources: cast.sources.map((s) => ({
        label: s.label || null,
        quality: s.quality || null,
        height: s.height || null,
        bitrateKbps: s.bitrate_kbps || null,
        sizeBytes: s.size_bytes || null,
        url: s.url,
      })),
      expiresAt: cast.expiresAt || null,
      streamProxy: `/api/v1/proxy/hls?url=${encodeURIComponent(cast.m3u8)}`,
    };
  }

  // Case D: HYDRAX (AbyssPlayer / SoTrym) -> encrypted media config -> signed 2MiB chunks
  if (server === 'hydrax' || rawEmbedUrl.includes('abyssplayer')) {
    const slug = rawEmbedUrl.replace(/\/$/, '').split('/').pop();
    const ctx = await fetchHydraxMedia(slug);

    return {
      server,
      id,
      provider: 'hydrax',
      streamType: 'mp4',
      title: '',
      poster: '',
      slug,
      md5Id: ctx.payload.md5_id,
      sources: listHydraxSources(ctx),
      // Virtual MP4 endpoint: presents the selected quality as one continuous file
      // (Range-aware; each edge chunk is 2 MiB and supports internal Range).
      fileUrl: `/api/v1/proxy/hydrax/stream/${slug}`,
      streamProxy: `/api/v1/proxy/hydrax/stream/${slug}`,
      note: 'Hydrax menyajikan MP4 terenkripsi per chunk 2 MiB; endpoint /proxy/hydrax/stream/{slug} menyatukannya jadi satu file MP4 dengan dukungan Range/seek.',
    };
  }

  // Case E: other encrypted third-party player (embed-only)
  return {
    server,
    id,
    provider: 'external',
    streamType: 'embed',
    title: '',
    poster: '',
    embedUrl: rawEmbedUrl,
    note: 'Server ini diproteksi encrypted player bawaan pihak ketiga. Gunakan server p2p, turbovip, cast, atau hydrax untuk direct link.',
  };
}
