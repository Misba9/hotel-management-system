/**
 * Admin dashboard Firebase Messaging service worker.
 * Loads public config from /api/firebase-messaging-config.
 */
/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

fetch("/api/firebase-messaging-config")
  .then(function (res) {
    return res.json();
  })
  .then(function (cfg) {
    if (!cfg || !cfg.apiKey || !cfg.appId || !cfg.projectId) {
      throw new Error("Missing Firebase messaging config.");
    }
    firebase.initializeApp(cfg);
    var messaging = firebase.messaging();
    messaging.onBackgroundMessage(function (payload) {
      var title = (payload && payload.notification && payload.notification.title) || "Admin update";
      var options = {
        body: (payload && payload.notification && payload.notification.body) || "You have a new update."
      };
      self.registration.showNotification(title, options);
    });
  })
  .catch(function (err) {
    console.error("[admin firebase-messaging-sw] init failed", err);
  });
