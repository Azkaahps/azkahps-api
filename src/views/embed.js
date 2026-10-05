export function renderEmbedPlayer({ title, poster, streamUrl, server, id, streamType = 'hls' }) {
  if (streamUrl) {
    const isMp4 = streamType === 'mp4';
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'AzkaHPS Video Player'}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; font-family: sans-serif; }
    video { width: 100%; height: 100%; object-fit: contain; }
    #error-box { display: none; color: #ef4444; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div id="error-box">
    <h3>Gagal memutar video</h3>
    <p id="error-msg"></p>
  </div>
  <video id="video" controls autoplay playsinline poster="${poster || ''}"></video>
  <script>
    const video = document.getElementById('video');
    const streamUrl = '${streamUrl}';
    const isMp4 = ${isMp4};
    const errorBox = document.getElementById('error-box');
    const errorMsg = document.getElementById('error-msg');

    // Fullscreen wajib landscape (mobile/tablet): begitu masuk fullscreen,
    // minta layar mengunci landscape. Di browser yang tidak mendukung
    // (iOS/iPadOS), request ini diabaikan dengan aman.
    (function () {
      function syncOrientation() {
        var doc = document;
        var fsEl = doc.fullscreenElement || doc.webkitFullscreenElement;
        try {
          if (fsEl && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
          } else if (!fsEl && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        } catch (e) { /* ignore */ }
      }
      document.addEventListener('fullscreenchange', syncOrientation);
      document.addEventListener('webkitfullscreenchange', syncOrientation);
    })();

    function showError(msg) {
      video.style.display = 'none';
      errorBox.style.display = 'block';
      errorMsg.textContent = msg;
    }

    if (isMp4) {
      // Progressive MP4 (Range-aware virtual file, e.g. hydrax chunk assembly)
      video.src = streamUrl;
      video.addEventListener('error', function () {
        showError('Gagal memuat MP4: ' + (video.error ? video.error.message : 'unknown'));
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({ debug: false, enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              showError('Fatal HLS error: ' + data.details);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    } else {
      showError('Browser tidak mendukung pemutaran video HLS.');
    }
  </script>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server ${server.toUpperCase()} Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #09090b; color: #f4f4f5; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; padding: 20px; }
    .card { max-width: 480px; background: #121215; border: 1px solid #27272a; border-radius: 12px; padding: 24px; text-align: center; }
    h3 { font-size: 18px; margin-bottom: 12px; color: #fbbf24; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <h3>Server ${server.toUpperCase()}</h3>
    <p>Stream HLS langsung tidak tersedia untuk server ini.</p>
  </div>
</body>
</html>`;
}
