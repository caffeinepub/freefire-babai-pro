importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCgaTpvwfcZd3HUWDYZnZwJwW5huZkOT6I",
  authDomain: "ff-war-ddbd9.firebaseapp.com",
  projectId: "ff-war-ddbd9",
  storageBucket: "ff-war-ddbd9.firebasestorage.app",
  messagingSenderId: "74327419970",
  appId: "1:74327419970:web:90f5acc982203672fbd1db",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'MR.SONIC FF';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
