// Bump this version when publishing changes to the offline resources.
const PREFIX='bftma-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+'v9';
const FILES=[
  './','index.html','index_pvp.html','manifest.webmanifest',
  'src/app.js','src/characters/catalog.js','src/network/pvp.js','src/network/prediction.js','src/engine/arsenal.js','src/ui/coin.js',
  'src/engine/ai.js','src/engine/combat.js','src/engine/game.js','src/engine/projectiles.js','src/engine/terrain.js','src/engine/orbital.js','src/ui/orbital-art.js',
  'src/levels/index.js','src/ui/battle-hud.js','src/ui/camera.js','src/ui/characters.js',
  'src/ui/combat-art.js','src/ui/customization.js','src/ui/game.css','src/ui/input.js',
  'src/ui/preparation.js','src/ui/renderer.js','src/ui/results.js','src/ui/scenery.js','src/ui/pwa.js','src/ui/weapon-art.js','src/ui/teleport-effects.js','src/ui/weapon-presentation.js',
  'assets/weapons/arsenal-v1.png','assets/weapons/arsenal-v1.frames.json','assets/weapons/orbital-satellite-v1.png','assets/weapons/orbital-radio-v1.png',
  'assets/characters/raccoon.png','assets/characters/accessories.png','assets/effects/combat-atlas.png',
  'assets/backgrounds/puerto-tampico.png','assets/terrains/fondo1.png',
  'assets/terrains/islas-gemelas-v2.png','assets/terrains/carguero-tampico.png',
  'assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png','assets/icons/favicon-32.png'
];
const urls=FILES.map(path=>new URL(path,self.registration.scope).href);
const allowed=new Set(urls);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  // External matchmaking is never cached: online PvP always requires Internet.
  if(request.mode!=='navigate'&&!allowed.has(url.origin+url.pathname))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok){
        try{
          const cache=await caches.open(CACHE);
          await cache.put(url.origin+url.pathname,response.clone());
        }catch{/* Storage limits must not prevent playing online. */}
      }
      return response;
    }catch{
      const cache=await caches.open(CACHE);
      const saved=await cache.match(url.origin+url.pathname);
      if(saved)return saved;
      if(request.mode==='navigate')return cache.match(new URL('index.html',self.registration.scope).href);
      return Response.error();
    }
  })());
});
