import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCStS8j1u6NA66zE-4SGdeXS-JawSr-kQo",
  authDomain: "restobot-80b61.firebaseapp.com",
  projectId: "restobot-80b61",
  databaseURL: "https://restobot-80b61-default-rtdb.firebaseio.com/",
  storageBucket: "restobot-80b61.firebasestorage.app",
  messagingSenderId: "161239523782",
  appId: "1:161239523782:web:170c52fdc7c189ac7052c7",
  measurementId: "G-BEWLHC1YS6"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue };
