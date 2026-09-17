import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBx9-2F6PCefhJknbzh5T2oSRWwgdvzZP0",
  authDomain: "upheld-welder-321314.firebaseapp.com",
  projectId: "upheld-welder-321314",
  storageBucket: "upheld-welder-321314.firebasestorage.app",
  messagingSenderId: "658565745414",
  appId: "1:658565745414:web:a8e2712f9a58383252ac87"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "dost-koleji-prod-db");

async function check() {
  const docRef = doc(db, "pages", "aylik-yemek-menusu");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log(JSON.stringify(docSnap.data().blocks, null, 2));
  } else {
    console.log("No such document!");
  }
  process.exit(0);
}
check();
