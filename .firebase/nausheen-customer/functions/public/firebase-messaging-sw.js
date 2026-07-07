/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging — background handler.
 * Loads public config from /api/firebase-messaging-config (same origin).
 * Keep compat SDK version aligned with customer-web `firebase` dependency (~11.x).
 */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function () {
  self.clients.claim();
});

fetch("/api/firebase-messaging-config")
  .then(function (res) {
    return res.json();
  })
  .then(function (config) {
    if (config.error) return;
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    var messaging = firebase.messaging();
    messaging.onBackgroundMessage(function (payload) {
      var title = (payload.notification && payload.notification.title) || "Order update";
      var body = (payload.notification && payload.notification.body) || "";
      return self.registration.showNotification(title, {
        body: body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: payload.data || {}
      });
    });
  })
  .catch(function (err) {
    console.error("[firebase-messaging-sw] init failed", err);
  });

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  var orderId = data.orderId;
  var url =
    typeof orderId === "string" && orderId.length > 0
      ? "/tracking?trackingId=" + encodeURIComponent(orderId)
      : "/orders";
  event.waitUntil(self.clients.openWindow(url));
});
