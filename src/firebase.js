import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDMO41dBZm5UF8fldXfLhu_WSrE0TZAKi8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "latoallaapp-daf6c.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "latoallaapp-daf6c",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "latoallaapp-daf6c.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "403031848271",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:403031848271:web:9e88b4b9006588b6f2c13a"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;