export function renderDocsHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AZKAHPS UNIFIED MEDIA API - Developer Portal & Guide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #000000;
      --card: #0a0a0a;
      --card-hover: #111111;
      --border: #222222;
      --border-light: #333333;
      --text: #ededed;
      --text-muted: #888888;
      --accent: #ffffff;
      --code-bg: #050505;
      --tag-get: #1e293b;
      --tag-get-text: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border-radius: 0 !important;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.6;
      padding: 40px 20px;
    }

    .container {
      max-width: 1120px;
      margin: 0 auto;
    }

    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.03em;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .version-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 3px 8px;
      background: #151515;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
    }

    .meta-bar {
      display: flex;
      gap: 20px;
      margin-top: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
    }

    .meta-item span {
      color: var(--text);
      font-weight: 600;
    }

    /* Main Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 28px;
    }

    .tab-btn {
      background: #080808;
      border: 1px solid var(--border);
      border-bottom: none;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 10px 18px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      background: #141414;
      color: var(--text);
    }

    .tab-btn.active {
      background: #ffffff;
      color: #000000;
      border-color: #ffffff;
    }

    /* Filter Sub-Bar */
    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      align-items: center;
    }

    .filter-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-right: 8px;
    }

    .filter-chip {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 5px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .filter-chip:hover {
      border-color: var(--border-light);
      color: var(--text);
    }

    .filter-chip.active {
      background: #222;
      color: #fff;
      border-color: #444;
    }

    /* Tab Content Views */
    .tab-view {
      display: none;
    }

    .tab-view.active {
      display: block;
    }

    .section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 32px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .endpoint-card {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s ease;
    }

    .endpoint-card:hover {
      background: var(--card-hover);
      border-color: var(--border-light);
    }

    .endpoint-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      min-width: 0;
    }

    .method-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      background: var(--tag-get);
      color: var(--tag-get-text);
      border: 1px solid rgba(255, 255, 255, 0.1);
      letter-spacing: 0.05em;
    }

    .endpoint-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .endpoint-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-left: 12px;
      display: inline-block;
    }

    .btn-test {
      background: #ffffff;
      color: #000000;
      border: 1px solid #ffffff;
      padding: 5px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-test:hover {
      background: #cccccc;
      border-color: #cccccc;
    }

    /* Documentation Articles & Guides */
    .guide-box {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 24px;
      margin-bottom: 24px;
    }

    .guide-box h2 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      text-transform: uppercase;
      margin-bottom: 12px;
      color: #fff;
    }

    .guide-box h3 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      text-transform: uppercase;
      margin: 18px 0 8px 0;
      color: var(--text);
    }

    .guide-box p, .guide-box li {
      font-size: 13px;
      color: #b0b0b0;
      line-height: 1.6;
    }

    .guide-box ul, .guide-box ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #d1d5db;
      overflow-x: auto;
      margin: 12px 0;
      line-height: 1.5;
    }

    /* Modal Runner */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: var(--card);
      border: 1px solid var(--border-light);
      width: 100%;
      max-width: 860px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
    }

    .modal-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text);
      word-break: break-all;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
    }

    .modal-close:hover {
      color: var(--text);
    }

    .modal-meta {
      padding: 10px 20px;
      background: #050505;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      flex-wrap: wrap;
    }

    .badge-status {
      padding: 2px 6px;
      background: #111;
      border: 1px solid var(--border);
      color: #10b981;
    }

    .badge-status.error {
      color: #ef4444;
    }

    .modal-body {
      padding: 16px 20px;
      overflow-y: auto;
      flex: 1;
      background: var(--code-bg);
    }

    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #d1d5db;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .modal-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card);
    }

    .btn-secondary {
      background: #181818;
      color: var(--text);
      border: 1px solid var(--border-light);
      padding: 6px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      cursor: pointer;
    }

    .btn-secondary:hover {
      background: #252525;
    }

    footer {
      margin-top: 60px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <h1>AZKAHPS UNIFIED MEDIA REST API</h1>
        <span class="version-badge">v1.0.0 - MODULAR MONOLITH</span>
      </div>
      <p class="subtitle">Unified On-Demand Scraper & Streaming Proxy Gateway for Movies, Anime, and Comics.</p>
      <div class="meta-bar">
        <div class="meta-item">ARCHITECTURE: <span>Provider Registry Pattern</span></div>
        <div class="meta-item">ENGINE: <span>Hono v4 on Node.js</span></div>
        <div class="meta-item">SERVER: <span>Ubuntu 24.04 (192.168.1.103)</span></div>
        <div class="meta-item">TUNNEL: <span>Cloudflare Zero Trust</span></div>
      </div>
    </header>

    <!-- Top Navigation: Explorer vs Developer Guide -->
    <div class="nav-tabs">
      <button class="tab-btn active" onclick="switchNavTab('explorer')">API EXPLORER & TESTER</button>
      <button class="tab-btn" onclick="switchNavTab('guide')">DEVELOPER GUIDE & ARCHITECTURE</button>
    </div>

    <!-- VIEW 1: API EXPLORER -->
    <div id="view-explorer" class="tab-view active">
      <!-- Filter Chips -->
      <div class="filter-bar">
        <span class="filter-label">Category:</span>
        <button class="filter-chip active" onclick="filterCategory('all')">ALL</button>
        <button class="filter-chip" onclick="filterCategory('movie')">MOVIE (LK21)</button>
        <button class="filter-chip" onclick="filterCategory('anime')">ANIME (Kuramanime)</button>
        <button class="filter-chip" onclick="filterCategory('comic')">COMIC (Ikiru)</button>
        <button class="filter-chip" onclick="filterCategory('shortdrama')">SHORT DRAMA (Melolo)</button>
        <button class="filter-chip" onclick="filterCategory('proxy')">MEDIA PROXY</button>
      </div>

      <!-- Section: System -->
      <div class="category-group" data-category="system">
        <div class="section-title">00. System & Metrics</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/health</div>
                <div class="endpoint-desc">Health check, server uptime, heap memory usage, cache stats, & registered providers</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/health')">TEST RUNNER</button>
          </div>
        </div>
      </div>

      <!-- Section: Movies -->
      <div class="category-group" data-category="movie">
        <div class="section-title">01. Movie & Series (LK21 / Layarkaca21)</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/home</div>
                <div class="endpoint-desc">Latest movie releases, trending series, and recommended titles</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/home')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/search?q=avatar&page=1</div>
                <div class="endpoint-desc">Search movie and drama series titles via backend search engine</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/search?q=avatar&page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/movies?page=1&sort=latest</div>
                <div class="endpoint-desc">Full movies catalog pagination (sort: latest, popular, rating, release)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/movies?page=1&sort=latest')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/series?page=1&sort=latest-series</div>
                <div class="endpoint-desc">Full TV & Drakor series catalog pagination from dramamu mirror</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/series?page=1&sort=latest-series')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/detail/avatar-the-way-of-water-2022</div>
                <div class="endpoint-desc">Content metadata, synopsis, cast, directors, and episode listing</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/detail/avatar-the-way-of-water-2022')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/movie/stream/p2p/avatar-the-way-of-water-2022</div>
                <div class="endpoint-desc">Direct M3U8 HLS stream resolver (supported servers: p2p, turbovip, cast, hydrax)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/movie/stream/p2p/avatar-the-way-of-water-2022')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/hydrax/info/JNnUKZRWb</div>
                <div class="endpoint-desc">Hydrax (AbyssPlayer) media info: decrypted source list (480p/720p/1080p) + chunk counts</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/hydrax/info/JNnUKZRWb')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/hydrax/stream/JNnUKZRWb?res=5</div>
                <div class="endpoint-desc">Hydrax virtual MP4 endpoint - Range-aware assembly of signed 2 MiB edge chunks (seek supported)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/hydrax/stream/JNnUKZRWb?res=5')">TEST RUNNER</button>
          </div>
        </div>
      </div>

      <!-- Section: Anime -->
      <div class="category-group" data-category="anime">
        <div class="section-title">02. Anime (Kuramanime)</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/home</div>
                <div class="endpoint-desc">Latest ongoing anime episodes and recently updated series</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/home')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/search?q=naruto&page=1</div>
                <div class="endpoint-desc">Search anime catalog by title with pagination</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/search?q=naruto&page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/ongoing?page=1</div>
                <div class="endpoint-desc">List currently airing / ongoing seasonal anime</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/ongoing?page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/movies?page=1</div>
                <div class="endpoint-desc">List anime feature films and standalone OVAs</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/movies?page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/detail/228/naruto</div>
                <div class="endpoint-desc">Anime detail, synopsis, genres, score, and all episodes</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/detail/228/naruto')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/anime/stream/228/naruto/1</div>
                <div class="endpoint-desc">Direct MP4 video stream (360p, 480p, 720p) and downloads</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/anime/stream/228/naruto/1')">TEST RUNNER</button>
          </div>
        </div>
      </div>

      <!-- Section: Comic -->
      <div class="category-group" data-category="comic">
        <div class="section-title">03. Comic & Manga (Ikiru)</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/home</div>
                <div class="endpoint-desc">Unified homepage compilation (popular today, latest updates, projects)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/home')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/latest?page=1&per_page=20</div>
                <div class="endpoint-desc">Full catalog pagination (8,100+ series) sorted by latest updates</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/latest?page=1&per_page=20')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/search?q=solo&page=1</div>
                <div class="endpoint-desc">Search comic series with optional filters (type, genre, orderby)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/search?q=solo&page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/genres</div>
                <div class="endpoint-desc">Taxonomy metadata: list of all available genres, types, and counts</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/genres')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/detail/solo-leveling</div>
                <div class="endpoint-desc">Comic metadata: synopsis, genres, rating, views, and initial chapters</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/detail/solo-leveling')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/chapters/6?page=1&per_page=100</div>
                <div class="endpoint-desc">Complete paginated chapter listing for a series by Manga ID</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/chapters/6?page=1&per_page=100')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/comic/chapter/269591</div>
                <div class="endpoint-desc">Chapter reader images array + prev/next chapter navigation</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/comic/chapter/269591')">TEST RUNNER</button>
          </div>
        </div>
      </div>

      <!-- Section: Short Drama -->
      <div class="category-group" data-category="shortdrama">
        <div class="section-title">04. Short Drama (Multi-Provider Engine: Melolo, ShortMax, ReelShort, FlickReels, etc.)</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/providers</div>
                <div class="endpoint-desc">List of all 16 supported short drama platforms with active status and icons</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/providers')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/home</div>
                <div class="endpoint-desc">Default provider home catalog compilation (Melolo)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/home')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/shortmax/home</div>
                <div class="endpoint-desc">Explicit provider home catalog (ShortMax: 100+ titles)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/shortmax/home')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/latest</div>
                <div class="endpoint-desc">Latest short drama releases feed</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/latest')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/catalog?page=1</div>
                <div class="endpoint-desc">Full drama catalog pagination (alldrama)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/catalog?page=1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/search?q=cinta&lang=id</div>
                <div class="endpoint-desc">Search short dramas across platforms by keyword and language</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/search?q=cinta&lang=id')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/episodes/7594776181166050357</div>
                <div class="endpoint-desc">Full episode list for a drama with video IDs, duration, and lock status</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/episodes/7594776181166050357')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/stream/7594776181166050357/1</div>
                <div class="endpoint-desc">Direct MP4 video stream resolver (Melolo multi-quality 720p/540p/480p/360p)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/stream/7594776181166050357/1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/shortdrama/reelshort/stream/6a9fa7885ca348a0e50b4697/1</div>
                <div class="endpoint-desc">Direct HLS video stream resolver (ReelShort CDN fallback)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/shortdrama/reelshort/stream/6a9fa7885ca348a0e50b4697/1')">TEST RUNNER</button>
          </div>
        </div>
      </div>

      <!-- Section: Proxy -->
      <div class="category-group" data-category="proxy">
        <div class="section-title">05. Unified Media Proxy Engine</div>
        <div class="endpoint-list">
          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/stream?url={videoUrl}</div>
                <div class="endpoint-desc">HLS playlist & media chunks stream proxy (Range bytes & CORS bypass)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/stream?url=https%3A%2F%2Fcommondatastorage.googleapis.com%2Fgtv-videos-bucket%2Fsample%2FForBiggerBlazes.mp4')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/hls?url={playlistUrl}</div>
                <div class="endpoint-desc">HLS playlist proxy - rewrites every segment through /proxy/ts (CORS + wrapper stripping)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/hls?url=https%3A%2F%2Fstream.playcdn.de%2Fplaylist%2F8c036b25bb08a027525b0670d925c36c%2F1%2F0.m3u8%3Fx%3D1')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/ts?url={segmentUrl}</div>
                <div class="endpoint-desc">TS segment proxy - strips PNG wrappers (turbovip), adds CORS (p2p), returns video/mp2t</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/ts?url=https%3A%2F%2Fduck.qornexia.xyz%2Fdocs%2F8c036b25bb08a027525b0670d925c36c%2F000.pict')">TEST RUNNER</button>
          </div>

          <div class="endpoint-card">
            <div class="endpoint-left">
              <span class="method-tag">GET</span>
              <div>
                <div class="endpoint-path">/api/v1/proxy/image?url={imageUrl}</div>
                <div class="endpoint-desc">High-performance image proxy (auto Referer spoofing & immutable caching)</div>
              </div>
            </div>
            <button class="btn-test" onclick="runTest('/api/v1/proxy/image?url=https%3A%2F%2Fcdn.itachi.my.id%2Fwp-content%2Fuploads%2Fimages%2Fs%2Fsolo-leveling%2Fchapter-spesial%2F1.jpg')">TEST RUNNER</button>
          </div>
        </div>
      </div>
    </div>

    <!-- VIEW 2: DEVELOPER GUIDE -->
    <div id="view-guide" class="tab-view">
      <div class="guide-box">
        <h2>📖 Panduan Integrasi Frontend (Next.js / React)</h2>
        <p>Semua endpoint mengembalikan kontrak <strong>Unified Response Envelope</strong> yang seragam:</p>
        <div class="code-block">{
  "ok": true,
  "category": "comic",
  "provider": "ikiru",
  "cached": true,
  "timestamp": "2026-09-11T13:45:00.000Z",
  "data": { ... }
}</div>

        <h3>Contoh Fetching di Next.js (TypeScript)</h3>
        <div class="code-block">export async function fetchMedia&lt;T&gt;(endpoint: string): Promise&lt;T&gt; {
  const res = await fetch(\`https://api.azkahps.online/api/v1\${endpoint}\`, {
    next: { revalidate: 300 } // ISR 5 menit
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'API Error');
  return json.data;
}

// Penggunaan di Page Component:
const comic = await fetchMedia&lt;ComicDetail&gt;('/comic/detail/solo-leveling');
const anime = await fetchMedia&lt;AnimeDetail&gt;('/anime/detail/228/naruto');
const movie = await fetchMedia&lt;MovieDetail&gt;('/movie/detail/avatar-the-way-of-water-2022');</div>
      </div>

      <div class="guide-box">
        <h2>🛠️ Cara Menambah Provider Baru (Provider Registry Pattern)</h2>
        <p>Arsitektur dibuat modular dengan <strong>Provider Registry Pattern</strong>. Menambahkan scraper baru (misal: novel/donghua atau provider film alternatif) tidak akan mengubah core server:</p>
        
        <h3>Langkah 1: Buat Folder Provider</h3>
        <p>Buat subfolder baru di dalam <code>src/providers/{category}/{provider-name}/</code>:</p>
        <div class="code-block">src/providers/novel/bakapervert/
├── client.js   // Logika scraping atau request upstream
└── index.js    // Hono router yang mengekspor router & metadata</div>

        <h3>Langkah 2: Tulis Router Provider</h3>
        <div class="code-block">import { Hono } from 'hono';
import { successResponse, errorResponse } from '../../../utils/response.js';

export const novelRouter = new Hono();
const CATEGORY = 'novel';
const PROVIDER = 'bakapervert';

novelRouter.get('/home', async (c) => {
  const data = await fetchNovelHome();
  return successResponse(c, { category: CATEGORY, provider: PROVIDER, data });
});

export const metadata = {
  name: 'BakaPervert',
  category: CATEGORY,
  slug: PROVIDER,
  version: '1.0.0',
  description: 'Light novel reader scraper'
};</div>

        <h3>Langkah 3: Daftarkan di <code>src/providers/registry.js</code></h3>
        <p>Tambahkan 1 entri pada array <code>PROVIDERS</code>:</p>
        <div class="code-block">import { novelRouter, metadata as novelMeta } from './novel/bakapervert/index.js';

export const PROVIDERS = [
  // ... providers yang sudah ada
  {
    category: 'novel',
    provider: 'bakapervert',
    isDefault: true,
    meta: novelMeta,
    router: novelRouter
  }
];</div>
        <p>Endpoint otomatis aktif di <code>/api/v1/novel/*</code> dan <code>/api/v1/novel/bakapervert/*</code> tanpa perlu konfigurasi tambahan!</p>
      </div>

      <div class="guide-box">
        <h2>🖥️ Panduan Deployment ke Ubuntu Home Server</h2>
        <p>Service siap dideploy ke PC Home Server lokal (Ubuntu 24.04 LTS) via PM2 dan Cloudflare Tunnel:</p>
        <div class="code-block"># 1. Masuk ke home server
ssh azka@192.168.1.103

# 2. Clone atau sync repo
cd /home/azka/services/azkahps-api
npm install --omit=dev

# 3. Jalankan via PM2
pm2 start ecosystem.config.cjs
pm2 save

# 4. Bind Cloudflare Zero Trust Tunnel
# Hubungkan hostname api.azkahps.online ke service http://localhost:3005</div>
      </div>
    </div>

    <footer>
      <div>AZKAHPS UNIFIED API ENGINE</div>
      <div>MONOCHROME SPEC &bull; ZERO BORDER-RADIUS</div>
    </footer>
  </div>

  <!-- Modal Runner -->
  <div class="modal-overlay" id="modalOverlay" onclick="handleOverlayClick(event)">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="modalTitle">REQUEST: ...</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-meta">
        <div>STATUS: <span id="modalStatus" class="badge-status">---</span></div>
        <div>TIME: <span id="modalTime" style="color: var(--text);">---</span></div>
        <div>SIZE: <span id="modalSize" style="color: var(--text);">---</span></div>
        <div>CACHE: <span id="modalCache" style="color: var(--text);">---</span></div>
      </div>
      <div class="modal-body">
        <pre id="modalContent">// Loading response...</pre>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="copyJson()" id="copyBtn">COPY JSON</button>
        <button class="btn-secondary" onclick="closeModal()">CLOSE (ESC)</button>
      </div>
    </div>
  </div>

  <script>
    let currentResponseText = '';

    function switchNavTab(tab) {
      document.querySelectorAll('.nav-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));

      if (tab === 'explorer') {
        document.querySelector('.nav-tabs button:nth-child(1)').classList.add('active');
        document.getElementById('view-explorer').classList.add('active');
      } else {
        document.querySelector('.nav-tabs button:nth-child(2)').classList.add('active');
        document.getElementById('view-guide').classList.add('active');
      }
    }

    function filterCategory(cat) {
      document.querySelectorAll('.filter-bar .filter-chip').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      const groups = document.querySelectorAll('.category-group');
      groups.forEach(group => {
        if (cat === 'all' || group.dataset.category === cat || group.dataset.category === 'system') {
          group.style.display = 'block';
        } else {
          group.style.display = 'none';
        }
      });
    }

    async function runTest(path) {
      const modal = document.getElementById('modalOverlay');
      const modalTitle = document.getElementById('modalTitle');
      const modalStatus = document.getElementById('modalStatus');
      const modalTime = document.getElementById('modalTime');
      const modalSize = document.getElementById('modalSize');
      const modalCache = document.getElementById('modalCache');
      const modalContent = document.getElementById('modalContent');
      const copyBtn = document.getElementById('copyBtn');

      modalTitle.innerText = 'GET ' + path;
      modalStatus.innerText = 'FETCHING';
      modalStatus.className = 'badge-status';
      modalTime.innerText = '...';
      modalSize.innerText = '...';
      modalCache.innerText = '...';
      modalContent.innerText = '// Sending HTTP request to ' + path + '...';
      copyBtn.innerText = 'COPY JSON';

      modal.classList.add('active');

      const startTime = performance.now();
      try {
        const res = await fetch(path);
        const duration = Math.round(performance.now() - startTime);
        modalTime.innerText = duration + ' ms';

        modalStatus.innerText = res.status + ' ' + res.statusText;
        if (!res.ok) modalStatus.classList.add('error');

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          currentResponseText = JSON.stringify(json, null, 2);
          modalSize.innerText = (new Blob([currentResponseText]).size / 1024).toFixed(2) + ' KB';
          modalCache.innerText = json.cached ? 'HIT' : 'MISS';
          modalContent.innerText = currentResponseText;
        } else {
          const blob = await res.blob();
          modalSize.innerText = (blob.size / 1024).toFixed(2) + ' KB';
          modalCache.innerText = 'N/A';
          currentResponseText = '[Binary Stream: ' + contentType + ' - ' + (blob.size / 1024).toFixed(2) + ' KB]';
          modalContent.innerText = currentResponseText;
        }
      } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        modalTime.innerText = duration + ' ms';
        modalStatus.innerText = 'ERROR';
        modalStatus.classList.add('error');
        modalContent.innerText = '// Request failed:\\n' + err.message;
      }
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
    }

    function handleOverlayClick(e) {
      if (e.target.id === 'modalOverlay') closeModal();
    }

    function copyJson() {
      if (!currentResponseText) return;
      navigator.clipboard.writeText(currentResponseText).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.innerText = 'COPIED!';
        setTimeout(() => { btn.innerText = 'COPY JSON'; }, 2000);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;
}
