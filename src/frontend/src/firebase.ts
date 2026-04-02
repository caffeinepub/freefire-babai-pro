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

export const VAPID_KEY =
  "BCzMqbB_dFDAD5hkqs_tqprrJRnSwSA1kU8lc4GoVKd4wYNY-pj6VAtjXlio3tP-HIsmb2W3oBOy83-pnr1V-Fc";

export const FCM_SERVER_KEY = "";
