import crypto from 'node:crypto';
import { CONFIG } from '../../../config.js';

/**
 * CAST (mfw09.org / "Byse" player) RESOLVER
 * =========================================
 * Flow (reverse-engineered, verified live):
 *
 * 1. The embed code (e.g. "asp2tsve85gp") is requested from
 *      POST /api/videos/{code}/embed/captcha        -> { pow_nonce, pow_difficulty, pow_token }
 *    All embed endpoints require the origin headers the player uses:
 *      X-Embed-Origin: https://videonode.de  (+ referer/parent variants)
 *
 * 2. Solve the proof-of-work: find `s` so that
 *      leadingZeroBits( hash(nonce + ":" + s) ) >= difficulty
 *    using the player's custom 512-byte sponge hash (ported below).
 *
 * 3. POST /api/videos/{code}/embed/captcha/verify  { pow_token, solution } -> { token }
 *
 * 4. POST /api/videos/{code}/embed/playback  { fingerprint: {} }
 *      headers: X-Captcha-Token: <token>
 *    -> { playback: { algorithm, iv, payload, key_parts? } }  (AES-GCM, base64url)
 *    Decrypt with the version-selected key parts -> { sources: [{ url: master.m3u8, ... }] }
 */

export const CAST_BASE = 'https://mfw09.org';
export const CAST_EMBED_ORIGIN = 'https://videonode.de';

const CAST_HEADERS = {
  'User-Agent': CONFIG.USER_AGENT,
  'X-Embed-Origin': CAST_EMBED_ORIGIN,
  'X-Embed-Referer': `${CAST_EMBED_ORIGIN}/`,
  'X-Embed-Parent': CAST_EMBED_ORIGIN,
  'Content-Type': 'application/json',
};

/* ------------------------------------------------------------------ */
/* PoW hash (ported 1:1 from the player's pow bundle)                  */
/* ------------------------------------------------------------------ */

const POW_STATE = 512;
const POW_MASK = POW_STATE - 1;
const POW_ROUNDS = 2;
const POW_LR = 2654435761;
const POW_HR = 2246822519;

const rotl = (t, e) => ((t << e) | (t >>> (32 - e))) >>> 0;
const imul32 = (t, e) => Math.imul(t, e) >>> 0;

function powPermute(t) {
  t[0] = (t[0] + t[1]) >>> 0;
  t[3] = rotl(t[3] ^ t[0], 16);
  t[2] = (t[2] + t[3]) >>> 0;
  t[1] = rotl(t[1] ^ t[2], 12);
  t[0] = (t[0] + t[1]) >>> 0;
  t[3] = rotl(t[3] ^ t[0], 8);
  t[2] = (t[2] + t[3]) >>> 0;
  t[1] = rotl(t[1] ^ t[2], 7);
}

/** Custom sponge hash: returns Uint32Array(8) digest words. */
function powHash(bytes) {
  const e = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762]);
  for (let i = 0; i < bytes.length; i++) {
    e[0] = (e[0] + bytes[i]) >>> 0;
    e[0] = rotl(e[0], 7);
    powPermute(e);
  }
  for (let i = 0; i < 8; i++) powPermute(e);

  const r = new Uint32Array(POW_STATE);
  for (let i = 0; i < POW_STATE; i++) {
    powPermute(e);
    r[i] = (e[0] ^ e[2]) >>> 0;
  }
  for (let round = 0; round < POW_ROUNDS; round++) {
    for (let s = 0; s < POW_STATE; s++) {
      const a = r[s] & POW_MASK;
      let c = (r[s] + r[a]) >>> 0;
      c = rotl(c, 13);
      c = (c ^ imul32(r[(s + 1) & POW_MASK], POW_LR)) >>> 0;
      r[s] = c;
      e[0] = (e[0] ^ c) >>> 0;
      powPermute(e);
    }
  }

  const out = new Uint32Array(8);
  const block = POW_STATE / 8;
  for (let i = 0; i < 8; i++) {
    powPermute(e);
    let s = e[0];
    const base = i * block;
    for (let c = 0; c < block; c++) {
      const d = r[base + c];
      s = (s + d) >>> 0;
      s = rotl(s, 5);
      s = (s ^ imul32(d, POW_HR)) >>> 0;
    }
    out[i] = (s ^ e[2]) >>> 0;
  }
  return out;
}

function leadingZeroBits(words) {
  let bits = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 0) {
      bits += 32;
      continue;
    }
    return bits + Math.clz32(w);
  }
  return bits;
}

const charsToBytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 255;
  return out;
};

/** Solve PoW: returns the decimal solution string, or null on timeout. */
export async function solveCastPow(nonce, difficulty, timeoutMs = 30000) {
  if (!difficulty || difficulty <= 0) return '0';
  const prefix = `${nonce}:`;
  const started = Date.now();
  let s = 0;
  const batch = 2048;
  for (;;) {
    for (let i = 0; i < batch; i++) {
      const digest = powHash(charsToBytes(prefix + s));
      if (leadingZeroBits(digest) >= difficulty) return String(s);
      s++;
    }
    if (Date.now() - started > timeoutMs) return null;
    // Yield so the event loop (and HTTP server) stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/* ------------------------------------------------------------------ */
/* Playback payload decryption (AES-GCM with version-selected key)     */
/* ------------------------------------------------------------------ */

const CAST_KEY_ORDER = {};
for (let n = 1; n <= 20; n++) CAST_KEY_ORDER[String(n)] = [n, 31 - n];

const b64urlDecode = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = t.length % 4 === 0 ? 0 : 4 - t.length % 4;
  return Buffer.from(t + '='.repeat(pad), 'base64');
};

function selectCastKeyParts(payload) {
  const parts = Array.isArray(payload.key_parts) ? payload.key_parts : [];
  const order = CAST_KEY_ORDER[String(payload.version)];
  let selected = [];
  if (order) {
    const [a, b] = order;
    if (!(a < 1 || b < 1 || a > parts.length || b > parts.length)) {
      selected = [parts[a - 1], parts[b - 1]].filter((x) => typeof x === 'string' && x.length > 0);
    }
  }
  if (selected.length === 0) selected = parts.filter((x) => typeof x === 'string' && x.length > 0);
  return selected;
}

function decryptCastPlayback(payload) {
  const key = Buffer.concat(selectCastKeyParts(payload).map(b64urlDecode));
  const iv = b64urlDecode(payload.iv);
  const data = b64urlDecode(payload.payload);
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv(`aes-${key.length * 8}-gcm`, key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
}

/* ------------------------------------------------------------------ */
/* Public resolver                                                     */
/* ------------------------------------------------------------------ */

/**
 * Full CAST resolution for an embed code. Returns
 * { sources, posterUrl, expiresAt, m3u8 } where m3u8 is the master playlist.
 * `baseUrl` lets callers pass the detected host (domain rotates: mfw09, mfw10, ...).
 */
export async function resolveCastStream(code, baseUrl = CAST_BASE) {
  if (!code) throw new Error('CAST: embed code is required');
  const base = baseUrl.replace(/\/$/, '');
  const referer = `${base}/e/${code}`;
  const headers = { ...CAST_HEADERS, Referer: referer, Origin: base };

  // 1) captcha challenge
  const captchaRes = await fetch(`${base}/api/videos/${code}/embed/captcha`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!captchaRes.ok) throw new Error(`CAST captcha HTTP ${captchaRes.status}`);
  const captcha = await captchaRes.json();

  // 2) proof of work
  const solution = await solveCastPow(captcha.pow_nonce, captcha.pow_difficulty);
  if (!solution) throw new Error('CAST: PoW timed out');

  // 3) verify -> captcha token
  const verifyRes = await fetch(`${base}/api/videos/${code}/embed/captcha/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pow_token: captcha.pow_token, solution }),
  });
  if (!verifyRes.ok) throw new Error(`CAST verify HTTP ${verifyRes.status}`);
  const verified = await verifyRes.json();
  if (verified.status !== 'ok' || !verified.token) {
    throw new Error(`CAST verify rejected: ${JSON.stringify(verified).slice(0, 200)}`);
  }

  // 4) playback (AES-GCM payload)
  const playbackRes = await fetch(`${base}/api/videos/${code}/embed/playback`, {
    method: 'POST',
    headers: { ...headers, 'X-Captcha-Token': verified.token },
    body: JSON.stringify({ fingerprint: {} }),
  });
  if (!playbackRes.ok) throw new Error(`CAST playback HTTP ${playbackRes.status}`);
  const playbackBody = await playbackRes.json();
  if (!playbackBody?.playback) throw new Error('CAST playback payload missing');

  const decrypted = decryptCastPlayback(playbackBody.playback);
  const sources = (decrypted.sources || []).filter((s) => s?.url);

  return {
    code,
    m3u8: sources[0]?.url || null,
    sources,
    tracks: decrypted.tracks || [],
    posterUrl: decrypted.poster_url || '',
    generatedAt: decrypted.generated_at || null,
    expiresAt: decrypted.expires_at || null,
  };
}
