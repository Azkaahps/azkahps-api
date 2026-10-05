export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3005,
  HOST: process.env.HOST || '0.0.0.0',
  TIMEOUT_MS: 15000,
  // Connect/TTFB deadline for the media streaming proxy ONLY.
  // Once upstream response headers arrive, the body streams WITHOUT a deadline,
  // so a long MP4 is never cut off mid-playback. The old AbortSignal.timeout()
  // killed the response stream ~15s in, which the player surfaced as
  // "Video Playback due to a network error".
  STREAM_CONNECT_TIMEOUT_MS: 30000,
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  UPSTREAMS: {
    LK21: 'https://tv12.lk21official.cc',
    DRAMA: 'https://dramamu.lk21.de',
    KURAMANIME: 'https://v20.kuramanime.ing',
    IKIRU: 'https://08.ikiru.wtf',
    LAPAKDRACIN: 'https://lapakdracin.com/api',
    MELOLO_SEARCH: 'https://melolo.goodbos.online'
  },
  CACHE_TTL: {
    HOME: 5 * 60 * 1000,         // 5 minutes
    SEARCH: 10 * 60 * 1000,      // 10 minutes
    CATALOG: 15 * 60 * 1000,     // 15 minutes
    DETAIL: 30 * 60 * 1000,      // 30 minutes
    SCHEDULE: 30 * 60 * 1000,    // 30 minutes
    STREAM: 1 * 60 * 60 * 1000,  // 1 hour
    CHAPTER: 24 * 60 * 60 * 1000 // 24 hours
  }
};
