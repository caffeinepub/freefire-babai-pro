import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCgaTpvwfcZd3HUWDYZnZwJwW5huZkOT6I",
  authDomain: "ff-war-ddbd9.firebaseapp.com",
  projectId: "ff-war-ddbd9",
  storageBucket: "ff-war-ddbd9.firebasestorage.app",
  messagingSenderId: "74327419970",
  appId: "1:74327419970:web:90f5acc982203672fbd1db",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let messaging: ReturnType<typeof getMessaging> | null = null;
try {
  messaging = getMessaging(app);
} catch (_) {
  // messaging not supported in this environment
}
export { messaging, getToken, onMessage };

// ── VAPID Key — Get from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = "YOUR_VAPID_KEY_HERE";

// ── FCM Server Key — Get from Firebase Console > Project Settings > Cloud Messaging (Legacy API)
export const FCM_SERVER_KEY = "YOUR_FCM_SERVER_KEY_HERE";
