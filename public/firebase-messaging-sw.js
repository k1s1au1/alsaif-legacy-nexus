// Firebase Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCbPxOtCK-mrTnlIENrz-PG-Oao4h5bgwo",
  authDomain: "alsaif-family-hub-rsmy.firebaseapp.com",
  projectId: "alsaif-family-hub-rsmy",
  storageBucket: "alsaif-family-hub-rsmy.firebasestorage.app",
  messagingSenderId: "471598482928",
  appId: "1:471598482928:web:b4899f018f1de5376ec935",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "إشعار جديد";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
