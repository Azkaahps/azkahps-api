const BASE = 'http://127.0.0.1:3005';

async function testEndpoint(name, path, validateFn) {
  process.stdout.write(`Testing ${name} (${path})... `);
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`);
    const time = Date.now() - start;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 100)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json()
      : await res.text();

    if (validateFn) {
      validateFn(data);
    }
    console.log(`\x1b[32mPASSED\x1b[0m (${time}ms)`);
    return true;
  } catch (err) {
    console.log(`\x1b[31mFAILED\x1b[0m: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 Starting AzkaHPS Unified Media REST API Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const tests = [
    // 1. System
    {
      name: 'System Health & Providers Registry',
      path: '/health',
      fn: (d) => {
        if (d.status !== 'ok') throw new Error('status not ok');
        if (!Array.isArray(d.providers) || d.providers.length < 3)
          throw new Error('providers list incomplete');
      }
    },
    {
      name: 'Developer Portal & Guide UI',
      path: '/docs',
      fn: (d) => {
        if (typeof d !== 'string' || !d.includes('AZKAHPS UNIFIED MEDIA REST API'))
          throw new Error('docs UI content mismatch');
      }
    },

    // 2. Comic (Ikiru)
    {
      name: 'Comic: Unified Home',
      path: '/api/v1/comic/home',
      fn: (d) => {
        if (!d.ok || d.category !== 'comic' || !Array.isArray(d.data.latestUpdates))
          throw new Error('invalid comic home payload');
      }
    },
    {
      name: 'Comic: Search',
      path: '/api/v1/comic/search?q=solo&page=1',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data.items))
          throw new Error('invalid comic search payload');
      }
    },
    {
      name: 'Comic: Detail (Solo Leveling)',
      path: '/api/v1/comic/detail/solo-leveling',
      fn: (d) => {
        if (!d.ok || d.data.slug !== 'solo-leveling')
          throw new Error('invalid comic detail');
      }
    },
    {
      name: 'Comic: Chapters List',
      path: '/api/v1/comic/chapters/6?page=1&per_page=10',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data.chapters))
          throw new Error('invalid comic chapters list');
      }
    },
    {
      name: 'Comic: Chapter Reader Images',
      path: '/api/v1/comic/chapter/269591',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data.images) || d.data.images.length === 0)
          throw new Error('invalid comic chapter images');
      }
    },

    // 3. Anime (Kuramanime)
    {
      name: 'Anime: Recent Updates / Home',
      path: '/api/v1/anime/home',
      fn: (d) => {
        if (!d.ok || d.category !== 'anime' || !Array.isArray(d.data))
          throw new Error('invalid anime home payload');
      }
    },
    {
      name: 'Anime: Search',
      path: '/api/v1/anime/search?q=naruto&page=1',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data))
          throw new Error('invalid anime search payload');
      }
    },
    {
      name: 'Anime: Detail & Episodes',
      path: '/api/v1/anime/detail/228/naruto',
      fn: (d) => {
        if (!d.ok || !d.data.title)
          throw new Error('invalid anime detail payload');
      }
    },

    // 4. Movie (LK21)
    {
      name: 'Movie: Unified Home',
      path: '/api/v1/movie/home',
      fn: (d) => {
        if (!d.ok || d.category !== 'movie')
          throw new Error('invalid movie home payload');
      }
    },
    {
      name: 'Movie: Search',
      path: '/api/v1/movie/search?q=avatar&page=1',
      fn: (d) => {
        if (!d.ok) throw new Error('invalid movie search payload');
      }
    },

    // 5. Short Drama (Multi-Provider Engine)
    {
      name: 'Short Drama: Providers List',
      path: '/api/v1/shortdrama/providers',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data) || d.data.length < 5)
          throw new Error('invalid providers list payload');
      }
    },
    {
      name: 'Short Drama: Unified Home (Melolo default)',
      path: '/api/v1/shortdrama/home',
      fn: (d) => {
        if (!d.ok || d.category !== 'shortdrama' || d.provider !== 'melolo')
          throw new Error('invalid shortdrama home payload');
        if (!Array.isArray(d.data.items))
          throw new Error('shortdrama items is not array');
      }
    },
    {
      name: 'Short Drama: Explicit Provider Home (ShortMax)',
      path: '/api/v1/shortdrama/shortmax/home',
      fn: (d) => {
        if (!d.ok || d.provider !== 'shortmax' || !Array.isArray(d.data.items))
          throw new Error('invalid shortmax home payload');
      }
    },
    {
      name: 'Short Drama: Search (Melolo)',
      path: '/api/v1/shortdrama/search?q=cinta&lang=id',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data.items) || d.data.items.length === 0)
          throw new Error('invalid shortdrama search payload');
      }
    },
    {
      name: 'Short Drama: Episodes (Melolo)',
      path: '/api/v1/shortdrama/episodes/7594776181166050357',
      fn: (d) => {
        if (!d.ok || !Array.isArray(d.data.episodes) || d.data.episodes.length === 0)
          throw new Error('invalid shortdrama episodes payload');
      }
    },
    {
      name: 'Short Drama: Stream URL (Melolo MP4)',
      path: '/api/v1/shortdrama/stream/7594776181166050357/1',
      fn: (d) => {
        if (!d.ok || !d.data.streamUrl || !Array.isArray(d.data.qualities))
          throw new Error('invalid shortdrama stream payload');
      }
    },
    {
      name: 'Short Drama: Stream URL (ReelShort HLS Fallback)',
      path: '/api/v1/shortdrama/reelshort/stream/6a9fa7885ca348a0e50b4697/1',
      fn: (d) => {
        if (!d.ok || !d.data.streamUrl || d.data.provider !== 'reelshort')
          throw new Error('invalid reelshort stream payload');
      }
    },

    // 6. Unified Media Proxy
    {
      name: 'Media Proxy: Chapter Image',
      path: '/api/v1/proxy/image?url=https%3A%2F%2Fcdn.itachi.my.id%2Fwp-content%2Fuploads%2Fimages%2Fs%2Fsolo-leveling%2Fchapter-spesial%2F1.jpg',
      fn: (d) => {
        if (!d || d.length === 0) throw new Error('empty proxy image payload');
      }
    }
  ];

  for (const t of tests) {
    total++;
    const ok = await testEndpoint(t.name, t.path, t.fn);
    if (ok) passed++;
  }

  console.log(`\n====================================================`);
  console.log(`Summary: ${passed}/${total} tests passed.`);
  console.log(`====================================================`);

  process.exit(passed === total ? 0 : 1);
}

runAllTests();
