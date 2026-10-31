const CACHE_NAME='learnflex-saathi-shell-v2';
const CORE_FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('learnflex-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 // Never cache API responses: classroom answers and shared state must stay fresh.
 if(url.pathname.startsWith('/api/'))return;
 event.respondWith(caches.match(request).then(cached=>{
  if(cached)return cached;
  return fetch(request).then(response=>{
   if(response&&response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)).catch(()=>{});}
   return response;
  }).catch(()=>request.mode==='navigate'?caches.match('./index.html'):Promise.reject(new Error('Offline resource not cached')));
 }));
});
