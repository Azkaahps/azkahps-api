# AzkaHPS Media REST API - Developer Guide & Architecture

Panduan teknis untuk developer mengenai arsitektur, cara menggunakan API, menambah provider scraper baru, dan deployment ke server.

---

## Arsitektur: Provider Registry Pattern (Modular Monolith)

Monolith modular ini dibangun agar mempermudah penambahan provider scraper baru tanpa merusak service yang sudah berjalan.

```text
src/
├── server.js # Entrypoint Hono, CORS, request logger
├── config.js # Konfigurasi port, timeouts, base URLs, TTL
├── cache.js # MemoryCache (LRU-like in-memory TTL)
├── utils/response.js # Kontrak baku: { ok, category, provider, cached, data }
├── routes/
│ ├── health.js # /health (RAM, uptime, cache stats)
│ └── proxy.js # /api/v1/proxy/stream & /api/v1/proxy/image
├── views/docs.js # Monochrome Developer Portal & Test Runner
└── providers/
 ├── registry.js # Registry pengatur auto-mounting router
 ├── movie/
 │ └── lk21/ # Provider Film/Series LK21
 ├── anime/
 │ └── kuramanime/ # Provider Streaming Anime Kuramanime
 └── comic/
 └── ikiru/ # Provider Komik/Manga Ikiru
```

Setiap provider didaftarkan di `src/providers/registry.js` dan otomatis menghasilkan 2 pola URL:
1. **Category Default:** `/api/v1/:category/*` (misal `/api/v1/comic/detail/solo-leveling`)
2. **Explicit Provider:** `/api/v1/:category/:provider/*` (misal `/api/v1/comic/ikiru/detail/solo-leveling`)

---

## Standar Kontrak JSON (Unified Response Envelope)

Semua response dari server wajib mengikuti format baku berikut:

### Sukses:
```json
{
 "ok": true,
 "category": "comic",
 "provider": "ikiru",
 "cached": false,
 "timestamp": "2026-09-11T13:50:00.000Z",
 "data": {
 "title": "Solo Leveling",
 "slug": "solo-leveling",
 ...
 }
}
```

### Gagal / Error Boundary:
```json
{
 "ok": false,
 "category": "movie",
 "provider": "lk21",
 "timestamp": "2026-09-11T13:50:00.000Z",
 "error": "Upstream timeout (15000ms)",
 "message": "Failed to resolve movie detail"
}
```

---

## Cara Menambah Provider Baru dalam 3 Langkah

Misalkan lu mau nambah provider scraper baru untuk **Light Novel** bernama `bakapervert`:

### Langkah 1: Buat Folder Provider
Buat direktori baru:
```bash
mkdir -p src/providers/novel/bakapervert
```

### Langkah 2: Tulis Scraper Client & Router
Buat `src/providers/novel/bakapervert/client.js` untuk logic fetch/cheerio, lalu buat `src/providers/novel/bakapervert/index.js`:
```javascript
import { Hono } from 'hono';
import { successResponse, errorResponse } from '../../../utils/response.js';

export const novelRouter = new Hono();
const CATEGORY = 'novel';
const PROVIDER = 'bakapervert';

novelRouter.get('/home', async (c) => {
 try {
 const data = await fetchNovelHome();
 return successResponse(c, { category: CATEGORY, provider: PROVIDER, data });
 } catch (error) {
 return errorResponse(c, { category: CATEGORY, provider: PROVIDER, error });
 }
});

export const metadata = {
 name: 'BakaPervert',
 category: CATEGORY,
 slug: PROVIDER,
 version: '1.0.0',
 description: 'Indonesian light novel reader scraper'
};
```

### Langkah 3: Daftarkan di `src/providers/registry.js`
Buka `src/providers/registry.js` dan tambahkan:
```javascript
import { novelRouter, metadata as novelMeta } from './novel/bakapervert/index.js';

export const PROVIDERS = [
 // ... providers yang sudah ada
 {
 category: 'novel',
 provider: 'bakapervert',
 isDefault: true,
 meta: novelMeta,
 router: novelRouter
 }
];
```

Selesai! Endpoint langsung aktif di:
- `GET /api/v1/novel/home`
- `GET /api/v1/novel/bakapervert/home`

---

## Contoh Integrasi Client (Next.js 15+ App Router)

```typescript
// lib/api.ts
interface ApiResponse<T> {
 ok: boolean;
 category: string;
 provider: string;
 cached: boolean;
 data: T;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.azkahps.online/api/v1';

export async function fetchApi<T>(endpoint: string, revalidate = 300): Promise<T> {
 const res = await fetch(`${API_BASE}${endpoint}`, {
 next: { revalidate }
 });

 if (!res.ok) {
 throw new Error(`API error HTTP ${res.status}`);
 }

 const json: ApiResponse<T> = await res.json();
 if (!json.ok) {
 throw new Error((json as any).message || 'API request failed');
 }

 return json.data;
}
```

---

## Deployment ke Ubuntu Home Server

1. **Copy atau Git Clone ke Server:**
 ```bash
 scp -r ./azkahps-api user@server:~/services/azkahps-api
 ```
2. **Install & Start via PM2:**
 ```bash
 cd ~/services/azkahps-api
 npm install --omit=dev
 pm2 start ecosystem.config.cjs
 pm2 save
 ```
3. **Cloudflare Tunnel Routing:**
 Di Cloudflare Zero Trust Dashboard -> Tunnels:
 - Tambahkan Public Hostname: `api.azkahps.online`
 - Service Type: `HTTP`
 - URL: `localhost:3005`
