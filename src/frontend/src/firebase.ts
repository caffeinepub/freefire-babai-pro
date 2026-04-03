import { getApps, initializeApp } from "firebase/app";
import {
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgaTpvwfcZd3HUWDYZnZwJwW5huZkOT6I",
  authDomain: "ff-war-ddbd9.firebaseapp.com",
  projectId: "ff-war-ddbd9",
  storageBucket: "ff-war-ddbd9.firebasestorage.app",
  messagingSenderId: "74327419970",
  appId: "1:74327419970:web:90f5acc982203672fbd1db",
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

export { doc, getDoc, setDoc, updateDoc, onSnapshot, deleteField };

export function generateRoomCode(): string {
  return `SKY-${Math.floor(1000 + Math.random() * 9000)}`;
}
