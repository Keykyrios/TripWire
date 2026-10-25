import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC3Sle1dclWzhoKnnXYzCS3UidxgKNjmPc",
  authDomain: "hackathon-1d30e.firebaseapp.com",
  databaseURL: "https://hackathon-1d30e-default-rtdb.firebaseio.com",
  projectId: "hackathon-1d30e",
  storageBucket: "hackathon-1d30e.firebasestorage.app",
  messagingSenderId: "887688616711",
  appId: "1:887688616711:web:a7b45c9c2781c5d86183a2",
  measurementId: "G-DSZXS35V2H",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Analytics only works in a real browser with cookies; skip quietly elsewhere.
isSupported()
  .then((ok) => {
    if (ok) getAnalytics(app);
  })
  .catch(() => undefined);

export const ROOT_PATH = "tripwire/rooms";
