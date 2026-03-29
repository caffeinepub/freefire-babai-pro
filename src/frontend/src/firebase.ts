import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
