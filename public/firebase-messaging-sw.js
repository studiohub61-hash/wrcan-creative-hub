/* Wanda background push worker. Config arrives via the registration query string. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || "Wanda";
  self.registration.showNotification(title, {
    body: data.body || "New message",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.conversationId || "wanda-chat",
    renotify: true,
    vibrate: [200, 80, 200, 80, 300],
    requireInteraction: true,
    data: { url: data.url || "/chat" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
