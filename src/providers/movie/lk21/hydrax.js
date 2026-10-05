import crypto from 'node:crypto';
import { CONFIG } from '../../../config.js';

/**
 * HYDRAX (AbyssPlayer / SoTrym) RESOLVER
 * ======================================
 * Flow (reverse-engineered, verified against the live player + its service worker):
 *
 * 1. Embed page  https://abyssplayer.com/{slug}  contains:
 *      const datas = "<base64>";   ->  { slug, md5_id, user_id, media }
 *    `media` is an AES-256-CTR ciphertext (raw bytes => decode base64 as latin1).
 *
 * 2. Config key   = md5( user_id + ":" + slug + ":" + md5_id )      (standard md5, utf8)
 *    media (plain) = AES-256-CTR decrypt, key = utf8(configKey), counter = key[0..16]
 *    -> JSON { mp4: { sources: [...], domains: [...], fristDatas: [...] } }
 *
 * 3. Each source has: res_id, size (bytes), codec, sub (edge domain marker).
 *    The video service worker streams 2 MiB chunks from the edge:
 *      chunk key  = md5( digits-of-size as byte values )   <- md5 quirks of the SW bundle
 *      chunk plain = "/mp4/{md5_id}/{res_id}/{size}/{chunkSize}/{chunkIndex}"
 *      signature   = double-base64-no-padding( AES-256-CTR-encrypt(chunk plain) )
 *      url         = https://{edgeDomain}/sora/{size}/{signature}
 *    The edge honors HTTP Range inside a single chunk (206 + Content-Range).
 *
 * So a full MP4 can be reconstructed by walking chunks 0..ceil(size/chunkSize)-1
 * sequentially, which is exactly what handleHydraxStreamProxy() does for players.
 */

export const HYDRAX_EMBED_BASE = 'https://abyssplayer.com';
export const HYDRAX_CHUNK_SIZE = 2097152; // 2 MiB, matches the SW route /chunk/:id/:size/:chunkSize/...

const HYDRAX_HEADERS = {
  'User-Agent': CONFIG.USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  Referer: 'https://videonode.de/',
};

const stdMd5 = (input) => crypto.createHash('md5').update(input).digest('hex');

/**
 * Chunk key: the SW's bundled md5 implementation is fed `size` as a *number*.
 * Its string->bytes path turns each digit character into the byte VALUE of that
 * digit (7, 5, 9, ...) instead of the ASCII codes (0x37, 0x35, 0x39, ...).
 * Verified against ground truth captured from the live service worker.
 */
function hydraxChunkKey(size) {
  const digits = Buffer.from(String(size), 'ascii');
  return crypto
    .createHash('md5')
    .update(Buffer.from(digits.map((c) => c - 48)))
    .digest('hex');
}

/** AES-256-CTR where key = utf8(hexKey) and counter = key.slice(0, 16). */
function aesCtrTransform(keyHex, data, encrypt = false) {
  const key = Buffer.from(keyHex, 'utf8');
  const counter = key.subarray(0, 16);
  const cipher = encrypt
    ? crypto.createCipheriv('aes-256-ctr', key, counter)
    : crypto.createDecipheriv('aes-256-ctr', key, counter);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

const b64NoPad = (buf) => buf.toString('base64').replace(/=+$/, '');
/** The player signs with base64(base64(cipher)) - no padding at either stage. */
const doubleB64NoPad = (buf) => b64NoPad(Buffer.from(b64NoPad(buf), 'ascii'));

/**
 * Fetch + decrypt the embed payload for a slug (e.g. "JNnUKZRWb").
 * Returns { payload: { slug, md5_id, user_id }, media: { mp4: {...} } }
 */
export async function fetchHydraxMedia(slug) {
  const res = await fetch(`${HYDRAX_EMBED_BASE}/${slug}`, {
    headers: HYDRAX_HEADERS,
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Hydrax embed HTTP ${res.status}`);

  const html = await res.text();
  const match = html.match(/const\s+datas\s*=\s*"([^"]+)"/);
  if (!match) throw new Error('Hydrax payload (const datas) not found in embed page');

  // NOTE: raw cipher bytes - decode base64 as latin1 so every byte survives.
  const payload = JSON.parse(Buffer.from(match[1], 'base64').toString('latin1'));
  if (!payload?.media || !payload?.md5_id || !payload?.user_id) {
    throw new Error('Hydrax payload is missing required fields');
  }

  const configKey = stdMd5(`${payload.user_id}:${payload.slug}:${payload.md5_id}`);
  const mediaBytes = Buffer.from(payload.media, 'latin1');
  const media = JSON.parse(aesCtrTransform(configKey, mediaBytes).toString('utf8'));

  if (!media?.mp4?.sources?.length) {
    throw new Error('Hydrax media payload has no MP4 sources');
  }

  return { payload, media };
}

/** Friendly source list for API consumers (highest size first per quality label). */
export function listHydraxSources({ payload, media }) {
  const seen = new Set();
  return (media.mp4.sources || [])
    .filter((s) => s.status !== false && s.codec !== 'aac')
    .filter((s) => {
      // Upstream kadang mengirim res_id sama dua kali (mis. 720p dobel) — dedupe.
      const key = String(s.res_id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({
      label: s.label || null,
      resId: s.res_id,
      size: s.size,
      codec: s.codec,
      sub: s.sub || null,
      partSize: s.partSize || 0,
      chunks: Math.ceil(s.size / HYDRAX_CHUNK_SIZE),
    }))
    .sort((a, b) => (b.size || 0) - (a.size || 0));
}

/** Pick the edge domain: prefer the source's own `sub` marker, else hash-fallback. */
export function pickHydraxDomain(media, source) {
  const domains = media.mp4.domains || [];
  if (!domains.length) throw new Error('Hydrax media has no edge domains');
  if (source.sub) {
    const match = domains.find((d) => d.includes(source.sub));
    if (match) return match;
  }
  return domains[source.size % domains.length];
}

/**
 * Build the signed /sora/ URL for one 2 MiB chunk of a source.
 * chunkIndex is 0-based; the edge also accepts Range within that chunk.
 */
export function buildHydraxChunkUrl({ payload, media }, source, chunkIndex) {
  const domain = pickHydraxDomain(media, source);
  const chunkKey = hydraxChunkKey(source.size);
  const plain = `/mp4/${payload.md5_id}/${source.res_id}/${source.size}/${HYDRAX_CHUNK_SIZE}/${chunkIndex}`;
  const signature = doubleB64NoPad(aesCtrTransform(chunkKey, Buffer.from(plain, 'utf8'), true));
  return `https://${domain}/sora/${source.size}/${signature}`;
}

/** Choose a source: explicit resId, else the best h264 quality, else the largest. */
export function pickHydraxSource(media, preferredResId = null) {
  const sources = (media.mp4.sources || []).filter((s) => s.status !== false && s.codec !== 'aac');
  if (!sources.length) throw new Error('No playable Hydrax sources');
  if (preferredResId != null) {
    const wanted = sources.find((s) => String(s.res_id) === String(preferredResId));
    if (wanted) return wanted;
  }
  const h264 = sources.filter((s) => s.codec === 'h264');
  const pool = h264.length ? h264 : sources;
  return pool.reduce((best, s) => (s.size > best.size ? s : best), pool[0]);
}

/**
 * Fetch one chunk (optionally a byte range inside it) from the edge.
 * Returns the upstream Response so callers can stream its body.
 */
export async function fetchHydraxChunk(chunkUrl, { start = null, end = null, signal = null } = {}) {
  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    Referer: 'https://player.abyssplayer.com/',
    Origin: 'https://player.abyssplayer.com',
    Accept: '*/*',
  };
  if (start != null && end != null) {
    headers.Range = `bytes=${start}-${end}`;
  }
  return fetch(chunkUrl, { headers, signal });
}
