import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js";

const firebaseConfig = {


  apiKey: "AIzaSyCi4ldLdVtWAUKb0wyyds2HnbNujjIHmWQ",


  authDomain: "guildrallyloots.firebaseapp.com",


  projectId: "guildrallyloots",


  storageBucket: "guildrallyloots.firebasestorage.app",


  messagingSenderId: "116266984921",


  appId: "1:116266984921:web:90326a9fed2ee48f79a5c8"


};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, getDoc, setDoc, updateDoc, arrayUnion };