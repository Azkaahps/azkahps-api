# AzkaHPS Unified Media REST API

Unified, high-performance scraper REST API and developer portal combining Movies (LK21), Anime (Kuramanime), and Comics (Ikiru) into a single modular monolith.

Built with Hono v4, Node.js, in-memory TTL caching, and the Provider Registry Pattern.

## Highlights

- Consolidated monolith: all scrapers run in one Node process at roughly 30-40 MB RAM.
- Unified JSON envelopes: every response shares `{ ok, category, provider, cached, data }`.
- Hybrid routing: use `/api/v1/:category/*` for default providers or `/api/v1/:category/:provider/*` for explicit targeting.
- Unified media proxy: `/api/v1/proxy/stream` (video byte-range and HLS CORS bypass) and `/api/v1/proxy/image` (referer spoofing and immutable caching).
- Interactive developer portal at `/docs`: strict monochrome UI with a real-time test runner modal and latency meter.
- Ready for extensions: add a new scraper (novels, donghua, indoxxi) in three steps without modifying core code.

## Tech Stack

- Runtime: Node.js 20+ (native ESM)
- Server framework: Hono v4 and @hono/node-server
- HTML parsing: Cheerio
- HTTP client: Axios
- Caching: custom in-memory LRU-style TTL cache with auto cleanup
- Testing: Node built-in test runner

## Quickstart

```bash
# Install dependencies
npm install

# Start development server (watch mode)
npm run dev

# Start production server
npm start
```

Visit `http://localhost:3005` or `http://localhost:3005/docs` for the interactive documentation.

## Configuration

Configuration lives in `src/config.js` and reads from environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| PORT | 3005 | HTTP port the server binds to |
| HOST | 0.0.0.0 | Bind address |

Upstream base URLs for each provider and the hierarchical TTL values are defined in `src/config.js`:

- Home / Latest feeds: 5 minutes
- Search results: 10 minutes
- Catalog pages: 15 minutes
- Detail pages: 30 minutes
- Stream links: 1 hour
- Chapter images: 24 hours

## API Reference

### System

- `GET /health` - server health, uptime, heap memory, cache stats, and registered providers.
- `GET /` and `GET /docs` - interactive monochrome developer portal and test runner.

### Movie and Series (LK21)

- `GET /api/v1/movie/home` - latest movies and trending series.
- `GET /api/v1/movie/search?q=avatar&page=1` - content search.
- `GET /api/v1/movie/movies?page=1&sort=latest` - movies catalog. Sorts: `latest`, `populer`, `rating`, `release`.
- `GET /api/v1/movie/series?page=1&sort=latest-series` - series and drama catalog.
- `GET /api/v1/movie/detail/:slug` - content metadata, synopsis, cast, and episode list.
- `GET /api/v1/movie/stream/:server/:id` - direct M3U8 HLS stream resolver (servers `p2p` and `turbovip`).
- `GET /api/v1/movie/embed/:server/:id` - iframe-ready HTML5 video player.

### Anime (Kuramanime)

- `GET /api/v1/anime/home` - recent episode releases.
- `GET /api/v1/anime/search?q=naruto&page=1` - anime search.
- `GET /api/v1/anime/ongoing?page=1` - seasonal ongoing anime.
- `GET /api/v1/anime/movies?page=1` - anime feature films.
- `GET /api/v1/anime/detail/:id/:slug` - anime metadata and episode list.
- `GET /api/v1/anime/stream/:id/:slug/:ep` - direct MP4 streams and download links.

### Comic (Ikiru)

- `GET /api/v1/comic/home` - popular today and latest updates.
- `GET /api/v1/comic/latest?page=1&per_page=20` - 8100+ series catalog.
- `GET /api/v1/comic/search?q=solo&page=1` - manga search with filters.
- `GET /api/v1/comic/genres` - taxonomy metadata.
- `GET /api/v1/comic/detail/:slug` - comic metadata and synopsis.
- `GET /api/v1/comic/chapters/:id?page=1` - full chapter listing by manga ID.
- `GET /api/v1/comic/chapter/:id` - chapter reader images array.

### Unified Media Proxy

- `GET /api/v1/proxy/stream?url={videoUrl}` - video HLS / MP4 stream proxy with Range header support.
- `GET /api/v1/proxy/image?url={imageUrl}` - image stream proxy with referer spoofing.
- `GET /api/v1/proxy/hydrax/stream/:slug` - direct Hydrax stream resolver.

## Response Envelope

Every success response follows the standard contract:

```json
{
  "ok": true,
  "category": "comic",
  "provider": "ikiru",
  "cached": false,
  "timestamp": "2026-09-11T13:50:00.000Z",
  "data": {}
}
```

Errors follow the same envelope with `ok: false`, an `error` code, and a human-readable `message`. See `DEVELOPER_GUIDE.md` for the full documentation.

## Adding a New Provider

1. Create a folder under `src/providers/<category>/<provider>/` with `client.js` (fetch and parse logic) and `index.js` (Hono router).
2. Export a Hono router and a `metadata` object.
3. Register the provider in the `PROVIDERS` array inside `src/providers/registry.js`.

The registry auto-mounts the router at both `/api/v1/:category/:provider/*` and the category default path. See `DEVELOPER_GUIDE.md` for a step-by-step walkthrough with a sample novel provider.

## Project Structure

```text
src/
  server.js              entrypoint, CORS, request logger, error handlers
  config.js              port, timeouts, upstream URLs, TTL values
  cache.js               in-memory LRU-style TTL cache
  utils/response.js      standard success and error envelopes
  routes/                health check, media proxy, hydrax resolver
  views/                 monochrome docs portal and iframe embed player
  providers/             one folder per scraper provider
    movie/lk21/          LK21 and Dramamu movie and series scraper
    anime/kuramanime/    Kuramanime anime scraper with token handshake
    comic/ikiru/         Ikiru comic reader scraper
test/
  api.test.js            integration test suite against a live server
```

## Testing

Start the server, then run the integration suite:

```bash
npm test
```

The suite hits live upstream endpoints and asserts HTTP status and the unified envelope across all providers.

## Deployment

The repo includes an `ecosystem.config.cjs` for PM2. On any Node 20+ host:

```bash
npm install --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
```

See `DEVELOPER_GUIDE.md` for architecture notes and deployment details.

## License

MIT
