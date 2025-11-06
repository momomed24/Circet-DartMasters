// storage.js - Gestion des joueurs et matchs avec Firebase Firestore

// --- IMPORTS FIREBASE ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, setDoc, getDocs, updateDoc 
} from "firebase/firestore";

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDopLci7L1EvUebzSermotMkMM-w5ocLzw",
  authDomain: "circet-dartmasters.firebaseapp.com",
  projectId: "circet-dartmasters",
  storageBucket: "circet-dartmasters.appspot.com",
  messagingSenderId: "184457292501",
  appId: "1:184457292501:web:3e409efb2953aa57af105c",
  measurementId: "G-2Y3SPXVFFC"
};

// --- INITIALISATION FIREBASE ---
const app = initial
