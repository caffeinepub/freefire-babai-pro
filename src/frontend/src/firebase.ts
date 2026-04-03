// @ts-nocheck
/* eslint-disable */
// Firebase v10.12.2 loaded from CDN using dynamic import with @vite-ignore

const FB_BASE = "https://www.gstatic.com/firebasejs/10.12.2";

// These will be populated after init
export let db: any = null;
export let messaging: any = null;
export const VAPID_KEY =
  "BCzMqbB_dFDAD5hkqs_tqprrJRnSwSA1kU8lc4GoVKd4wYNY-pj6VAtjXlio3tP-HIsmb2W3oBOy83-pnr1V-Fc";
export const FCM_SERVER_KEY = "";

// Firestore function exports (populated after init)
export let collection: any;
export let doc: any;
export let getDoc: any;
export let getDocs: any;
export let setDoc: any;
export let addDoc: any;
export let updateDoc: any;
export let deleteDoc: any;
export let onSnapshot: any;
export let query: any;
export let where: any;
export let orderBy: any;
export let limit: any;
export let serverTimestamp: any;
export let getToken: any;
export let onMessage: any;

let _initPromise: Promise<void> | null = null;
let _initialized = false;

export function isFirebaseReady() {
  return _initialized;
}

export async function initFirebase(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const [appModule, fsModule, msgModule] = await Promise.all([
      import(/* @vite-ignore */ `${FB_BASE}/firebase-app.js`),
      import(/* @vite-ignore */ `${FB_BASE}/firebase-firestore.js`),
      import(/* @vite-ignore */ `${FB_BASE}/firebase-messaging.js`).catch(
        () => null,
      ),
    ]);

    const firebaseConfig = {
      apiKey: "AIzaSyCgaTpvwfcZd3HUWDYZnZwJwW5huZkOT6I",
      authDomain: "ff-war-ddbd9.firebaseapp.com",
      projectId: "ff-war-ddbd9",
      storageBucket: "ff-war-ddbd9.firebasestorage.app",
      messagingSenderId: "74327419970",
      appId: "1:74327419970:web:90f5acc982203672fbd1db",
    };

    const app = appModule.initializeApp(firebaseConfig);
    db = fsModule.getFirestore(app);

    try {
      messaging = msgModule ? msgModule.getMessaging(app) : null;
    } catch (_) {
      messaging = null;
    }

    // Assign all firestore functions
    collection = fsModule.collection;
    doc = fsModule.doc;
    getDoc = fsModule.getDoc;
    getDocs = fsModule.getDocs;
    setDoc = fsModule.setDoc;
    addDoc = fsModule.addDoc;
    updateDoc = fsModule.updateDoc;
    deleteDoc = fsModule.deleteDoc;
    onSnapshot = fsModule.onSnapshot;
    query = fsModule.query;
    where = fsModule.where;
    orderBy = fsModule.orderBy;
    limit = fsModule.limit;
    serverTimestamp = fsModule.serverTimestamp;

    if (msgModule) {
      getToken = msgModule.getToken;
      onMessage = msgModule.onMessage;
    } else {
      getToken = async () => null;
      onMessage = () => {};
    }

    _initialized = true;
  })();

  return _initPromise;
}

// Start initializing immediately
initFirebase().catch(console.error);
