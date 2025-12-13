import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Copy, Plus, Play, X, Image as ImageIcon, Coins, UploadCloud, AlertTriangle, Loader2 } from 'lucide-react';

// Firebase ke zaroori imports (Ensure you have all necessary imports)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query } from 'firebase/firestore';

// IMPORTANT: Global Variables Canvas environment se
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Firebase config ko JSON string se object mein parse karein (safe parse)
let firebaseConfig = {};
try {
  firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
} catch (e) {
  console.error("Invalid __firebase_config JSON:", e);
}

// Initial auth token ko check karein
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase services ko initialize karein
let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Initialized Successfully.");
  } catch (e) {
    console.error("Firebase Initialization Failed:", e);
  }
} else {
  console.warn("Firebase Configuration is missing. Running in mock mode.");
}

export default function App() {
  const [images, setImages] = useState([]);
  const [userCoins, setUserCoins] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [adTimer, setAdTimer] = useState(5);
  const [pendingUnlockId, setPendingUnlockId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newImage, setNewImage] = useState({ title: '', url: '', prompt: '', category: 'General' });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopyMessage, setShowCopyMessage] = useState(false);

  // --- 1. Authentication aur Shuruwat ---
  useEffect(() => {
    // Agar Firebase initialize nahi hua hai, toh ruk jaao
    if (!db || !auth) {
      setError("Firebase configuration missing. App database se connect nahi ho sakta.");
      setLoading(false);
      return;
    }

    const authenticate = async () => {
      try {
        if (initialAuthToken) {
          // Custom token se sign-in karein
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          // Agar token nahi mila toh anonymous sign-in karein
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
        // Error ko user friendly banane ke liye
        setError(`Authentication mein galti: ${e.message}`);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      // Authentication ka status ready set karein
      setIsAuthReady(true);
      // Loading state ko tabhi band karein jab auth check poora ho jaaye
      setLoading(false);
    });

    authenticate();
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Yeh effect sirf shuru mein chalega

  // --- 2. Real-time Data Load (Photos aur Prompts) ---
  useEffect(() => {
    // Jab tak auth ready nahi, ya userId nahi, ya db nahi, tab tak na chalaayein
    if (!isAuthReady || !userId || !db) return;
    if (error) return;

    // Firestore Security Rules ke anusaar collection path:
    // artifacts/{appId}/users/{userId}/{collection_name}
    const collectionPath = `artifacts/${appId}/users/${userId}/ai_prompts`;
    const q = query(collection(db, collectionPath));

    // onSnapshot se real-time updates len
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Preserve any user-unlocked state on client if possible
        setImages((prev) => {
          const prevMap = Object.fromEntries(prev.map((p) => [p.id, p.isUnlocked]));
          const fetched = snapshot.docs.map((doc) => {
            const data = doc.data() || {};
            // Firestore Timestamp handling: agar timestamp ek Timestamp object ho toDate() se convert karein
            let ts = data.timestamp;
            if (ts && typeof ts.toDate === 'function') {
              ts = ts.toDate().toISOString();
            } else if (!ts) {
              ts = new Date().toISOString();
            }
            return {
              id: doc.id,
              ...data,
              timestamp: ts,
              // Preserve unlock state if user unlocked previously in this session
              isUnlocked: !!prevMap[doc.id],
            };
          });
          // Safe sort (fallback agar timestamp inconsistent ho)
          fetched.sort((a, b) => {
            const ta = Date.parse(a.timestamp || 0);
            const tb = Date.parse(b.timestamp || 0);
            return tb - ta;
          });
          setLoading(false);
          return fetched;
        });
      },
      (e) => {
        console.error("Firestore Fetch Error:", e);
        setError("Data load nahi ho pa raha. Kripya Console mein zaroori error dekhein.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, error, db]);

  // --- 3. Photo Upload Function ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database ready nahi hai ya user authenticated nahi hai. Submit nahi ho sakta.");
      return;
    }

    // Basic URL validation
    try {
      new URL(newImage.url);
    } catch {
      setError("Invalid image URL — kripya valid public https URL daaliye.");
      return;
    }

    try {
      const itemToSave = {
        ...newImage,
        timestamp: new Date().toISOString(),
        createdBy: userId,
      };

      const collectionPath = `artifacts/${appId}/users/${userId}/ai_prompts`;
      await addDoc(collection(db, collectionPath), itemToSave);

      // Form ko reset karein aur modal band karein
      setNewImage({ title: '', url: '', prompt: '', category: 'General' });
      setShowUploadModal(false);
    } catch (e) {
      console.error("Firestore Upload Error:", e);
      setError(`Photo upload karte samay error aa gaya: ${e.message}. URL sahi hai?`);
    }
  };

  // Ad aur Unlock ka logic
  useEffect(() => {
    let interval = null;

    if (showAd) {
      // Reset timer agar showAd true hai
      if (adTimer > 0) {
        interval = setInterval(() => {
          setAdTimer((prev) => Math.max(prev - 1, 0));
        }, 1000);
      } else if (adTimer === 0) {
        // agar timer 0 ho chuka hai to complete kar do
        completeAd();
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // we intentionally don't include completeAd in deps to avoid re-creating interval repeatedly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAd, adTimer]);

  const startAd = (id) => {
    setPendingUnlockId(id);
    setAdTimer(5); // 5 second ka mock ad time
    setShowAd(true);
  };

  const completeAd = () => {
    setShowAd(false);
    if (!pendingUnlockId) return;

    // Use functional update to avoid stale closures
    setImages((prev) =>
      prev.map((img) => (img.id === pendingUnlockId ? { ...img, isUnlocked: true } : img))
    );

    // Coin badhana (Example: 10 coins reward)
    setUserCoins((prev) => prev + 10);
    setPendingUnlockId(null);
  };

  const copyPrompt = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback for iframe/older browsers
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setShowCopyMessage(true);
      setTimeout(() => setShowCopyMessage(false), 2000); // 2 seconds ke baad hide
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Copy karne mein galti ho gayi. Kripya manual copy karein.');
    }
  };

  // --- UI Loading/Error States ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex items-center space-x-2">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-lg">Database se jood raha hai...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Galti (Error)</h1>
        <p className="text-red-300 text-center mb-4">Aapka app database se jud nahi paya. Kripya neeche dekhein:</p>
        <div className="bg-gray-800 p-4 rounded-lg text-sm max-w-lg w-full break-words">
          <h2 className="font-semibold text-yellow-400 mb-1">Detailed Error:</h2>
          <p className="text-gray-300">{error}</p>
        </div>
        <p className="text-sm text-gray-500 mt-4">Agar yeh error lagatar aata hai toh kripya browser Console mein Red errors (agar hain) zaroor check karein.</p>
      </div>
    );
  }

  // --- Main App UI ---
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ImageIcon size={28} className="text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">AI Prompts Gallery</h1>
              <p className="text-sm text-gray-400">Apni AI generated prompts aur images save karein</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right text-xs text-gray-400">
              <div>Coins: <span className="text-yellow-300 font-mono">{userCoins}</span></div>
            </div>

            <button 
              onClick={() => setShowUploadModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-all text-sm font-medium active:scale-95"
            >
              <UploadCloud size={18} className="mr-2" />
              Photo Upload Karein
            </button>
          </div>
        </div>

        <div className="bg-gray-700 p-2 text-center text-xs text-gray-400 mt-4 rounded">
          Aapka Private ID: <span className="font-mono text-purple-300 break-all">{userId || "Loading..."}</span>
        </div>
      </header>

      {/* Gallery Section */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {images.length === 0 ? (
          <div className="text-center p-10 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Gallery Khali Hai</h2>
            <p className="text-gray-400">Upar 'Photo Upload Karein' button se naya art aur prompt daalna shuru karein!</p>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded
