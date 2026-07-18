/* Convergencia — Service Worker (offline-first).
 * Sube CACHE al publicar una versión nueva para invalidar la caché anterior. */
const CACHE = 'cv-cache-v2.6.87';
const ASSETS = [
  './', './index.html', './styles.css?v=2.6.87', './game.js?v=2.6.87', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png',
  './fonts/NunitoSans-Variable.ttf',
  './img/ui-generated/chests/chest-open.png',
];
// Iconos de UI (pack en img/ui). Se precachean en best-effort: si alguno falla,
// no rompe la instalación (de todos modos el fetch los cachea en runtime).
const UI_ICONS = ['aura','bolt','bomb','book','calendar','cart','check','chest','clock','close','coin','crown','crystal','dice','fire','friend','gem','gift','heart','house','info','leaf','lock','luckyblock','magnet','medal','minus','music-off','music-on','pencil','pin','planet','planet-hell','player','players','plus','potion','question','rocket','search','settings','shield','skull','sound-off','sound-on','star','star-empty','stats','target','teleporter','ticket','trophy','upgrade','verify','warning'].map((n) => './img/ui/' + n + '.png');
// Subconjunto casual V2 usado por la home. Son derivados compactos para UI;
// preservan el arte y reducen el coste offline.
const HOME_V2_ICONS = ['bolt','calendar','cart','chest','clock','coin','fire','gem','gift','heart','house','medal','pencil','player','plus','robot','rocket','settings','shield','star','target','trophy','upgrade'].map((n) => './img/ui-v2/home/' + n + '.png');
const HOME_GENERATED_ART = [
  'avatar-robot','classic-board','daily-gift','header-coin-star','header-plus','hero-rocket','multiplayer-versus','tournament-trophy',
  'nav-achievements','nav-chest','nav-collections','nav-daily','nav-events','nav-friends','nav-guide','nav-home','nav-home-redesign','nav-league','nav-missions','nav-settings','nav-shop',
].map((n) => './img/ui-generated/home/' + n + '.png');
const MODE_GENERATED_ART = [
  'mode-classic','mode-multiplayer','mode-survival','mode-timed','mode-zen',
].map((n) => './img/ui-generated/modes/' + n + '.png');
const MODE_LAUNCH_ART = [
  'bolt','calendar','clock','coin','difficulty-easy','difficulty-hard','difficulty-normal',
  'frenzy-ring','heart','info','leaf','lock','medal','mode-adventure','mode-classic',
  'mode-timed','mode-zen','planet','rocket','skull','star','survival-emblem','survival-rank',
  'target','trophy',
].map((n) => './img/ui-generated/mode-launch/' + n + '.png');
const CHEST_ATLASES = [
  'wood','bronze','silver','gold','magic','royal','supreme','champion','divine','event',
].map((n) => './img/ui-generated/chests/atlas/' + n + '.png');
const V2_ICONS = [
  './img/icons-v2/1-game/double.svg',
  './img/icons-v2/2-items/map.svg',
  './img/icons-v2/3-gear/shield.svg',
  './img/icons-v2/4-nature/cactus.svg',
  './img/icons-v2/4-nature/drought.svg',
  './img/icons-v2/4-nature/meteor.svg',
  './img/icons-v2/4-nature/mountain.svg',
  './img/icons-v2/4-nature/snowflake.svg',
  './img/icons-v2/6-buildings/flag.svg',
  './img/icons-v2/6-buildings/town.svg',
  './img/icons-v2/8-ui/arrow-left.svg',
  './img/icons-v2/8-ui/arrow-left-02.svg',
  './img/icons-v2/8-ui/arrow-right-03.svg',
  './img/icons-v2/8-ui/circle-ring.svg',
  './img/icons-v2/8-ui/cross.svg',
  './img/icons-v2/8-ui/grid.svg',
  './img/icons-v2/8-ui/prohibited.svg',
  './img/icons-v2/8-ui/refresh.svg',
  './img/icons-v2/8-ui/rest.svg',
  './img/icons-v2/8-ui/user.svg',
  './img/icons-v2/8-ui/user-group.svg',
  './img/icons-v2/9-media/connection.svg',
  './img/icons-v2/9-media/download.svg',
  './img/icons-v2/9-media/link.svg',
  './img/icons-v2/9-media/mobile-phone.svg',
  './img/icons-v2/9-media/notification.svg',
  './img/icons-v2/9-media/pause.svg',
  './img/icons-v2/9-media/play.svg',
  './img/icons-v2/9-media/share.svg',
  './img/icons-v2/9-media/wi-fi.svg',
  './img/icons-v2/10-editing/brush.svg',
  './img/icons-v2/10-editing/font.svg',
  './img/icons-v2/12-misc/four-pointed-star.svg',
  './img/icons-v2/12-misc/radiation.svg',
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).then(() => Promise.all([
        c.addAll(UI_ICONS).catch(() => {}),
        c.addAll(HOME_V2_ICONS).catch(() => {}),
        c.addAll(HOME_GENERATED_ART).catch(() => {}),
        c.addAll(MODE_GENERATED_ART).catch(() => {}),
        c.addAll(MODE_LAUNCH_ART).catch(() => {}),
        c.addAll(CHEST_ATLASES).catch(() => {}),
        c.addAll(V2_ICONS).catch(() => {}),
      ])))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navegación: red primero (para ver versiones nuevas), cae a caché sin conexión.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Recursos: caché primero (offline instantáneo), con relleno de red.
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r;
    }).catch(() => m))
  );
});
