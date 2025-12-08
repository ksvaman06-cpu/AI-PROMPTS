import React, { useState, useEffect, useCallback } from 'react';import { Lock, Unlock, Copy, Plus, Play, X, Image as ImageIcon, Coins, UploadCloud, AlertTriangle, Loader2 } from 'lucide-react';// Firebase ke zaroori imports (Ensure you have all necessary imports)import { initializeApp } from 'firebase/app';import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';import { getFirestore, addDoc, onSnapshot, collection, query } from 'firebase/firestore';// IMPORTANT: Global Variables Canvas environment seconst appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';// Firebase config ko JSON string se object mein parse kareinconst firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};// Initial auth token ko check kareinconst initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;// Firebase services ko initialize kareinlet app, db, auth;if (Object.keys(firebaseConfig).length > 0) {try {app = initializeApp(firebaseConfig);db = getFirestore(app);auth = getAuth(app);console.log("Firebase Initialized Successfully.");} catch (e) {console.error("Firebase Initialization Failed:", e);}} else {console.warn("Firebase Configuration is missing. Running in mock mode.");}export default function App() {const [images, setImages] = useState([]);const [userCoins, setUserCoins] = useState(0);const [showAd, setShowAd] = useState(false);const [adTimer, setAdTimer] = useState(5);const [pendingUnlockId, setPendingUnlockId] = useState(null);const [showUploadModal, setShowUploadModal] = useState(false);const [newImage, setNewImage] = useState({ title: '', url: '', prompt: '', category: 'General' });const [isAuthReady, setIsAuthReady] = useState(false);const [userId, setUserId] = useState(null);const [loading, setLoading] = useState(true);const [error, setError] = useState(null);const [showCopyMessage, setShowCopyMessage] = useState(false);// --- 1. Authentication aur Shuruwat ---useEffect(() => {// Agar Firebase initialize nahi hua hai, toh ruk jaaoif (!db || !auth) {setError("Firebase configuration missing. App database se connect nahi ho sakta.");setLoading(false);return;}const authenticate = async () => {
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
  if (loading) {
    setLoading(false);
  }
});

authenticate();
return () => unsubscribe();
}, []); // Yeh effect sirf shuru mein chalega// --- 2. Real-time Data Load (Photos aur Prompts) ---useEffect(() => {// Jab tak auth ready nahi, ya userId nahi, ya db nahi, tab tak na chalaayeinif (!isAuthReady || !userId || !db) return;if (error) return;// Firestore Security Rules ke anusaar collection path:
// artifacts/{appId}/users/{userId}/{collection_name}
const collectionPath = `artifacts/${appId}/users/${userId}/ai_prompts`;
const q = query(collection(db, collectionPath));

// onSnapshot se real-time updates len
const unsubscribe = onSnapshot(q, (snapshot) => {
  const fetchedImages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    // Client-side state: Har baar load hone par lock rahega
    isUnlocked: false 
  }));
  // Data ko timestamp ke hisaab se sort karein
  setImages(fetchedImages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  setLoading(false);
}, (e) => {
  console.error("Firestore Fetch Error:", e);
  setError("Data load nahi ho pa raha. Kripya Console mein zaroori error dekhein.");
  setLoading(false);
});

return () => unsubscribe();
}, [isAuthReady, userId, error]); // Jab auth state ya userId badle tab re-run ho// --- 3. Photo Upload Function ---const handleUpload = async (e) => {e.preventDefault();if (!db || !userId) {setError("Database ready nahi hai ya user authenticated nahi hai. Submit nahi ho sakta.");return;}try {
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
};// Ad aur Unlock ka logicuseEffect(() => {let interval;if (showAd && adTimer > 0) {// 1 second ka timerinterval = setInterval(() => {setAdTimer((prev) => prev - 1);}, 1000);} else if (showAd && adTimer === 0) {completeAd();}return () => clearInterval(interval); // Cleanup}, [showAd, adTimer]);const startAd = (id) => {setPendingUnlockId(id);setAdTimer(5); // 5 second ka mock ad timesetShowAd(true);};const completeAd = () => {setShowAd(false);if (pendingUnlockId) {// Image ko unlock kareinsetImages(images.map(img =>img.id === pendingUnlockId ? { ...img, isUnlocked: true } : img));// Coin badhana (Example: 10 coins reward)setUserCoins(prev => prev + 10);setPendingUnlockId(null);}};const copyPrompt = (text) => {try {// document.execCommand('copy') is iframe environments ke liye behtar haiconst el = document.createElement('textarea');el.value = text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);  setShowCopyMessage(true);
  setTimeout(() => setShowCopyMessage(false), 2000); // 2 seconds ke baad hide
} catch (err) {
  console.error('Copy failed:', err);
  // Custom message box ki jagah console log
  alert('Copy karne mein galti ho gayi. Kripya manual copy karein.');
}
};// --- UI Loading/Error States ---if (loading) {return (<div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><div className="flex items-center space-x-2"><Loader2 size={32} className="animate-spin text-purple-500" /><p className="text-lg">Database se jood raha hai...</p></div></div>);}if (error) {return (<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4"><AlertTriangle size={48} className="text-red-500 mb-4" /><h1 className="text-xl font-bold mb-2">Galti (Error)</h1><p className="text-red-300 text-center mb-4">Aapka app database se jud nahi paya. Kripya neeche dekhein:</p><div className="bg-gray-800 p-4 rounded-lg text-sm max-w-lg w-full break-words"><h2 className="font-semibold text-yellow-400 mb-1">Detailed Error:</h2><p className="text-gray-300">{error}</p></div><p className="text-sm text-gray-500 mt-4">Agar yeh error lagatar aata hai toh kripya browser Console mein Red errors (agar hain) zaroor check karein.</p></div>);}// --- Main App UI ---return (<div className="min-h-screen bg-gray-900 text-white font-sans">{/* Header aur Navigation */}<header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10"><div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center"><div className="flex items-center space-x-2"><div className="bg-purple-600 p-2 rounded-lg"><ImageIcon size={24} /></div><h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">PromptMaster (LIVE Data)</h1></div>      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center bg-gray-700 px-3 py-1 rounded-full text-sm text-yellow-400">
          <Coins size={16} className="mr-2" />
          <span>Kamai (Simulated): ₹{(userCoins * 0.5).toFixed(2)}</span>
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
    <div className="bg-gray-700 p-2 text-center text-xs text-gray-400">
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
          className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center justify-center mx-auto transition-all text-sm font-medium"
        >
          <Plus size={18} className="mr-2" />
          Pehla Prompt Add Karein
        </button>
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
                  // Fallback image jab URL galat ho
                  e.target.src = `https://placehold.co/800x450/4B5563/FFFFFF?text=${img.title.replace(/\s/g, '+') || "Image+Not+Found"}`;
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
                    Yeh prompt ad dekhne ke baad hi unlock होगा...
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

  {/* Copy Message Toast */}
  {showCopyMessage && (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-xl transition-opacity duration-300 animate-fade-in">
      Prompt Copy Ho Gaya!
    </div>
  )}

  {/* Mock Ad Modal */}
  {showAd && (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4 text-gray-500 text-sm font-mono">
        Ad {adTimer}s mein band hoga
      </div>
      
      <div className="max-w-md w-full p-8 text-center bg-gray-900 rounded-xl border border-yellow-500 shadow-2xl">
        <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce">
          <Play size={40} className="text-black ml-1" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">SPONSOR ADVERTISEMENT</h2>
        <p className="text-gray-400 mb-8">
          (Real app mein yahan video ad chalega.)
        </p>
        
        <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
          <div 
            className="bg-yellow-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${((5 - adTimer) / 5) * 100}%` }}
          ></div>
        </div>
        
        {adTimer === 0 ? (
           <button 
             onClick={completeAd}
             className="text-white bg-green-600 px-6 py-2 rounded-full font-bold hover:bg-green-700 active:scale-95 transition-all"
           >
             Close & Reward Lein (10 Coins)
           </button>
        ) : (
           <p className="text-yellow-500 font-mono text-lg">Reward unlock ho raha hai...</p>
        )}
      </div>
    </div>
  )}

  {/* Upload Modal */}
  {showUploadModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-purple-700 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center"><UploadCloud size={20} className="mr-2 text-purple-400"/> Apni AI Art Add Karein</h3>
          <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleUpload} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Image Title</label>
            <input 
              required
              type="text" 
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
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
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
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
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono text-sm"
              placeholder="Woh jaadui prompt yahan likhein..."
              value={newImage.prompt}
              onChange={(e) => setNewImage({...newImage, prompt: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select 
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              value={newImage.category}
              onChange={(e) => setNewImage({...newImage, category: e.target.value})}
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
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors mt-2 disabled:opacity-50 flex items-center justify-center"
            disabled={!isAuthReady || !userId}
          >
            {(!isAuthReady || !userId) ? (
                <>
                    <Loader2 size={20} className="animate-spin mr-2"/> Database se jud raha hai...
                </>
            ) : 'Image Publish Karein'}
          </button>
        </form>
      </div>
    </div>
  )}
</div>
);}
