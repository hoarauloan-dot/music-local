'use strict';
// Cache limité à cette application : ne touche pas aux autres sites du compte GitHub.
const BASE = new URL('./', self.location.href).href;
const PREFIX = 'music-local:' + BASE + ':';
const CACHE = PREFIX + 'v4.2';
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon.png?v=4', 'apple-touch-icon.png', 'style.css', 'metadata.js', 'player.js', 'app.js'].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || !url.href.startsWith(BASE))return;
 if(event.request.mode === 'navigate') {
  event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL('index.html',BASE).href)).then(response => response || fetch(event.request)));
 }else if(ASSETS.includes(url.href)) {
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(response => response || fetch(event.request)));
 }
});
self.addEventListener('message', event => {
 if(event.data !== 'CHECK_READY' || !event.ports[0])return;
 event.waitUntil(caches.open(CACHE).then(async cache => {
  const responses = await Promise.all(ASSETS.map(url => cache.match(url)));
  if(responses.every(Boolean))event.ports[0].postMessage('READY');
 }));
});
