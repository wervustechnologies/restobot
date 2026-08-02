import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDiChYqZ7otrW-B1nGx-2pigNMsdoyN4iw",
  authDomain: "restobot-9cc82.firebaseapp.com",
  databaseURL: "https://restobot-9cc82-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "restobot-9cc82",
  storageBucket: "restobot-9cc82.firebasestorage.app",
  messagingSenderId: "1013973131823",
  appId: "1:1013973131823:web:a490c61bde75408f0d9cda",
  measurementId: "G-V5P47W3RC9"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue };
