import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Copy, Plus, Play, X, Image as ImageIcon, Coins, UploadCloud, AlertTriangle, Loader2 } from 'lucide-react';

// Firebase ke zaroori imports (Ensure you have all necessary imports)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query } from 'firebase/firestore';

// IMPORTANT: Global Variables Canvas environment se
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Firebase config ko JSON string se object mein parse karein
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

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
    if (!db || !auth) {
      setError("Firebase configuration missing. App database se connect nahi ho sakta.");
      setLoading(false);
      return;
    }

    const authenticate = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
        setError(`Authentication mein galti: ${e.message}`);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }

      setIsAuthReady(true);

      if (loading) {
        setLoading(false);
      }
    });

    authenticate();
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Data Load ---
  useEffect(() => {
    if (!isAuthReady || !userId || !db) return;
    if (error) return;

    const collectionPath = `artifacts/${appId}/users/${userId}/ai_prompts`;
    const q = query(collection(db, collectionPath));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedImages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isUnlocked: false,
        }));

        setImages(
          fetchedImages.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          )
        );

        setLoading(false);
      },
      (e) => {
        console.error("Firestore Fetch Error:", e);
        setError("Data load nahi ho pa raha. Console check karein.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, error]);

  // --- 3. Upload Function ---
  const handleUpload = async (e) => {
    e.preventDefault();

    if (!db || !userId) {
      setError("Database ready nahi hai ya user authenticated nahi hai.");
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

      setNewImage({ title: '', url: '', prompt: '', category: 'General' });
      setShowUploadModal(false);
    } catch (e) {
      console.error("Firestore Upload Error:", e);
      setError(`Photo upload error: ${e.message}`);
    }
  };

  // Ad Unlock Logic
  useEffect(() => {
    let interval;

    if (showAd && adTimer > 0) {
      interval = setInterval(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (showAd && adTimer === 0) {
      completeAd();
    }

    return () => clearInterval(interval);
  }, [showAd, adTimer]);

  const startAd = (id) => {
    setPendingUnlockId(id);
    setAdTimer(5);
    setShowAd(true);
  };

  const completeAd = () => {
    setShowAd(false);

    if (pendingUnlockId) {
      setImages(
        images.map((img) =>
          img.id === pendingUnlockId ? { ...img, isUnlocked: true } : img
        )
      );

      setUserCoins((prev) => prev + 10);
      setPendingUnlockId(null);
    }
  };

  const copyPrompt = (text) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);

      setShowCopyMessage(true);
      setTimeout(() => setShowCopyMessage(false), 2000);
    } catch (err) {
      alert("Copy karne mein samasya hai.");
    }
  };

  // Loading
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

  // Error Screen
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Error</h1>
        <p className="text-red-300 text-center mb-4">{error}</p>
      </div>
    );
  }

  // UI Rendering
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">

      {/* HEADER */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">

          <div className="flex items-center space-x-2">
            <div className="bg-purple-600 p-2 rounded-lg">
              <ImageIcon size={24} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              PromptMaster (LIVE Data)
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center bg-gray-700 px-3 py-1 rounded-full text-sm text-yellow-400">
              <Coins size={16} className="mr-2" />
              <span>Kamai (Simulated): ₹{(userCoins * 0.5).toFixed(2)}</span>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium"
            >
              <UploadCloud size={18} className="mr-2" />
              Photo Upload Karein
            </button>
          </div>

        </div>

        <div className="bg-gray-700 p-2 text-center text-xs text-gray-400">
          Aapka Private ID:{" "}
          <span className="font-mono text-purple-300">{userId}</span>
        </div>
      </header>

      {/* GALLERY */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {images.length === 0 ? (
          <div className="text-center p-10 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Gallery Khali Hai</h2>
            <p className="text-gray-400">
              Pehla prompt add karne ke liye upar button click karein
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center mx-auto text-sm font-medium"
            >
              <Plus size={18} className="mr-2" />
              Add First Prompt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img) => (
              <div
                key={img.id}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg"
              >
                <div className="relative aspect-video group">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/800x450/4B5563/FFFFFF?text=${
                        img.title.replace(/\s/g, "+") ||
                        "Image+Not+Found"
                      }`;
                    }}
                  />

                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
                    {img.category}
                  </div>

                  {!img.isUnlocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-black/80 text-white px-3 py-1 rounded-full text-sm flex items-center">
                        <Lock size={14} className="mr-2" /> Locked
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 truncate">
                    {img.title}
                  </h3>

                  {img.isUnlocked ? (
                    <div className="mt-3 bg-gray-900 p-3 rounded-lg border border-gray-600 relative">
                      <p className="text-gray-300 text-sm font-mono break-words pr-8">
                        {img.prompt}
                      </p>

                      <button
                        onClick={() => copyPrompt(img.prompt)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                      >
                        <Copy size={16} />
                      </button>

                      <div className="mt-2 flex items-center text-green-400 text-xs">
                        <Unlock size={12} className="mr-1" /> Unlock Ho Gaya
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-gray-500 text-sm mb-3">
                        Yeh prompt ad dekhne ke baad unlock hoga…
                      </p>

                      <button
                        onClick={() => startAd(img.id)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center"
                      >
                        <Play size={18} className="mr-2" />
                        Ad Dekh Kar Unlock Karein
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCopyMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg">
          Prompt Copy Ho Gaya!
        </div>
      )}

      {/* Ad Modal */}
      {showAd && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
          <div className="absolute top-4 right-4 text-gray-500 text-sm">
            Ad {adTimer}s mein band hoga
          </div>

          <div className="max-w-md w-full p-8 text-center bg-gray-900 rounded-xl border border-yellow-500">
            <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce">
              <Play size={40} className="text-black ml-1" />
            </div>

            <h2 className="text-3xl font-bold mb-2">SPONSOR ADVERTISEMENT</h2>
            <p className="text-gray-400 mb-8">
              (Real app mein yahan video ad chalega.)
            </p>

            <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="bg-yellow-500 h-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${((5 - adTimer) / 5) * 100}%`,
                }}
              ></div>
            </div>

            {adTimer === 0 ? (
              <button
                onClick={completeAd}
                className="bg-green-600 text-white px-6 py-2 rounded-full font-bold"
              >
                Close & Reward Lein (10 Coins)
              </button>
            ) : (
              <p className="text-yellow-500 font-mono text-lg">
                Reward unlock ho raha hai…
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-purple-700 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
              <h3 className="text-lg font-bold flex items-center">
                <UploadCloud size={20} className="mr-2 text-purple-400" />
                Apni AI Art Add Karein
              </h3>

              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Image Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white"
                  placeholder="Jaise: Neon Samurai"
                  value={newImage.title}
                  onChange={(e) =>
                    setNewImage({ ...newImage, title: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Image URL
                </label>
                <input
                  required
                  type="url"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white"
                  placeholder="Apna image link yahan daaliye..."
                  value={newImage.url}
                  onChange={(e) =>
                    setNewImage({ ...newImage, url: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Prompt
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white font-mono text-sm"
                  placeholder="Woh jaadui prompt likhein..."
                  value={newImage.prompt}
                  onChange={(e) =>
                    setNewImage({ ...newImage, prompt: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Category
                </label>
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white"
                  value={newImage.category}
                  onChange={(e) =>
                    setNewImage({ ...newImage, category: e.target.value })
                  }
                >
                  <option>General</option>
                  <option>Sci-Fi</option>
                  <option>Fantasy</option>
                  <option>Abstract</option>
                  <option>Nature</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center"
                disabled={!isAuthReady || !userId}
              >
                {!isAuthReady || !userId ? (
                  <>
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Database se jud raha hai...
                  </>
                ) : (
                  "Image Publish Karein"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
      }
