/* file: test.sw.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

self.addEventListener('install', function(event){
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event){
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event){
	event.respondWith(fetch(event.request));
});