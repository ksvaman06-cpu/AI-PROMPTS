import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Copy, Plus, Play, X, Image as ImageIcon, Coins, UploadCloud, AlertTriangle } from 'lucide-react';
// Firebase ke zaroori imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, onSnapshot, collection, query } from 'firebase/firestore';

// Zaroori Global Variables (Inko mat badlein)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase services ko initialize karein
let app, db, auth;
if (Object.keys(firebaseConfig).length) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export default function App() {
  const [images, setImages] = useState([]);
  const [userCoins, setUserCoins] = useState(0); 
  const [showAd, setShowAd] = useState(false);
  const [adTimer, setAdTimer] = useState(5);
  const [pendingUnlockId, setPendingUnlockId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newImage, setNewImage] = useState({ title: '', url: '', prompt: '', category: 'General' });
  
  // App ki sthiti (state)
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- 1. Authentication aur Shuruwat ---
  useEffect(() => {
    if (!db || !auth) return;

    const authenticate = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
        setError("Authentication (login) fail ho gayi. Dobara try karein.");
      }
    };

    // Auth state mein badlav ko sunne (listen)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    authenticate();
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Data Load (Photos aur Prompts) ---
  useEffect(() => {
    if (!isAuthReady || !userId || !db) return;

    // Firestore data ka private path: aapka data secure rahega.
    const collectionPath = `artifacts/${appId}/users/${userId}/ai_prompts`;
    const q = query(collection(db, collectionPath));
    
    // onSnapshot real-time data lata hai
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedImages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isUnlocked: false // Har session mein unlock status reset hoga
      }));
      // Naye photos hamesha sabse upar dikhe
      setImages(fetchedImages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      setLoading(false);
    }, (e) => {
      console.error("Firestore Fetch Error:", e);
      setError("Data load nahi ho pa raha. Network check karein.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId]);

  // --- 3. Photo Upload Function ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database ready nahi hai. Submit nahi ho sakta.");
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
      
      // Form reset aur modal band
      setNewImage({ title: '', url: '', prompt: '', category: 'General' });
      setShowUploadModal(false);
    } catch (e) {
      console.error("Firestore Upload Error:", e);
      setError("Photo upload karte samay error aa gaya. URL sahi hai?");
    }
  };


  // Ad aur Unlock ka logic (Jaise pahle tha)
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
      setImages(images.map(img => 
        img.id === pendingUnlockId ? { ...img, isUnlocked: true } : img
      ));
      setUserCoins(prev => prev + 10);
      setPendingUnlockId(null);
    }
  };

  const copyPrompt = (text) => {
    document.execCommand('copy'); 
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          <p>Database se jood raha hai...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Error!</h1>
        <p className="text-red-300 text-center">{error}</p>
        <p className="text-sm text-gray-500 mt-4">Agar yeh error baar-baar aaye, toh apne setup (Firebase/Network) ko check karein.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Header aur Navigation */}
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
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-all text-sm font-medium"
            >
              <UploadCloud size={18} className="mr-2" />
              Photo Upload Karein
            </button>
          </div>
        </div>
        <div className="bg-gray-700 p-2 text-center text-xs text-gray-400">
            Aapka Private ID: <span className="font-mono text-purple-300 break-all">{userId}</span>
        </div>
      </header>

      {/* Gallery Section */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {images.length === 0 ? (
          <div className="text-center p-10 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Gallery Khali Hai</h2>
            <p className="text-gray-400">Upar 'Photo Upload Karein' button se naya art aur prompt daalna shuru karein!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img) => (
              <div key={img.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg hover:shadow-purple-900/20 transition-all">
                {/* Image aur Overlay */}
                <div className="relative aspect-video group">
                  <img 
                    src={img.url} 
                    alt={img.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = `https://placehold.co/800x450/4B5563/FFFFFF?text=${img.title}`;
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold">
                    {img.category}
                  </div>
                  
                  {/* Lock Indicator */}
                  {!img.isUnlocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/80 text-white px-3 py-1 rounded-full text-sm flex items-center">
                        <Lock size={14} className="mr-2" /> Locked
                      </span>
                    </div>
                  )}
                </div>

                {/* Content aur Button */}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 truncate">{img.title}</h3>
                  
                  {img.isUnlocked ? (
                    <div className="mt-3 bg-gray-900 p-3 rounded-lg border border-gray-600 relative animate-fade-in">
                      <p className="text-gray-300 text-sm font-mono break-words pr-8 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                        {img.prompt}
                      </p>
                      <button 
                        onClick={() => copyPrompt(img.prompt)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                        title="Prompt Copy Karein"
                      >
                        <Copy size={16} />
                      </button>
                      <div className="mt-2 flex items-center text-green-400 text-xs font-medium">
                        <Unlock size={12} className="mr-1" /> Unlock Ho Gaya
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-gray-500 text-sm blur-sm select-none mb-3">
                        Yeh prompt ad dekhne ke baad ही unlock hoga...
                      </p>
                      <button
                        onClick={() => startAd(img.id)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center transition-all active:scale-95 shadow-lg"
                      >
                        <Play size={18} className="mr-2 fill-current" />
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

      {/* Mock Ad Modal */}
      {showAd && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="absolute top-4 right-4 text-gray-500 text-sm font-mono">
            Ad {adTimer}s mein band hoga
          </div>
          
          <div className="max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
              <Play size={40} className="text-black ml-1" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">SPONSOR ADVERTISEMENT</h2>
            <p className="text-gray-400 mb-8">
              (Real app mein yahan video ad chalega.)
            </p>
            
            <div className="w-full bg-gray-800 rounded-full h-2 mb-4 overflow-hidden">
              <div 
                className="bg-yellow-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - adTimer) / 5) * 100}%` }}
              ></div>
            </div>
            
            {adTimer === 0 ? (
               <button 
                 onClick={completeAd}
                 className="text-white bg-green-600 px-6 py-2 rounded-full font-bold hover:bg-green-700"
               >
                 Close & Reward Lein
               </button>
            ) : (
               <p className="text-yellow-500 font-mono">Reward unlock ho raha hai...</p>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal (Live DB connection ke saath) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-850">
              <h3 className="text-lg font-bold text-white">Apni AI Art Add Karein</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image Title</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Jaise: Neon Samurai"
                  value={newImage.title}
                  onChange={(e) => setNewImage({...newImage, title: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                <input 
                  required
                  type="url" 
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Apna image link yahan daaliye..."
                  value={newImage.url}
                  onChange={(e) => setNewImage({...newImage, url: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">Tip: Public hosting link (jaise Unsplash/Imgur) ka upyog karein.</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Prompt (Jo Ad ke baad dikhega)</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                  placeholder="Woh jaadui prompt yahan likhein..."
                  value={newImage.prompt}
                  onChange={(e) => setNewImage({...newImage, prompt: e.target.value})}
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors mt-2 disabled:opacity-50"
                disabled={!isAuthReady || !userId}
              >
                {(!isAuthReady || !userId) ? 'Database se jud raha hai...' : 'Image Publish Karein'}
              </button>
              {(!isAuthReady || !userId) && (
                <p className="text-center text-xs text-red-400">Database se judne ka intezaar hai. Please wait.</p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
