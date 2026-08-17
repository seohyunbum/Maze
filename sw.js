/* 오프라인 실행용 서비스 워커.
   비행기 모드에서도, 지하철에서도 앱이 그냥 열리게 한다.

   전략은 stale-while-revalidate:
   - 화면은 캐시에서 즉시 띄운다 (네트워크를 기다리지 않는다)
   - 동시에 뒤에서 새 파일을 받아 캐시를 갱신한다 → 다음 실행 때 최신판
   게임을 고쳐 배포할 때는 CACHE 의 버전을 반드시 올릴 것. */

const CACHE = 'maze-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 하나라도 실패해서 설치 전체가 깨지지 않도록 개별로 담는다
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (hit) return hit;                        // 캐시가 있으면 바로
    const res = await fresh;
    if (res) return res;

    // 오프라인인데 캐시에도 없는 경로(예: 새로고침 중 이동) → 앱 화면으로
    return (await cache.match('./index.html')) || Response.error();
  })());
});
