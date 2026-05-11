import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkPlatform = () => {
      const userAgent = window.navigator.userAgent;
      const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
      setIsIOS(isIOSDevice);
    };
    
    checkPlatform();
    
    // Check if running as PWA (installed)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsInstalled(isPWA);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or dismissed in session, or not relevant platform
  if (isInstalled || sessionStorage.getItem('installPromptDismissed')) return null;
  
  // For iOS, show only if not already in standalone mode (already checked above)
  // For Android/desktop, show only when beforeinstallprompt fires
  if (!showPrompt && !isIOS) return null;

  const isMobileSafari = isIOS && !window.MSStream;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 md:left-auto md:right-4 md:w-80">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shrink-0">
          <Share size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-slate-900 text-sm">Install BD Tracker</h3>
          <p className="text-xs text-slate-500 mt-1">
            {isIOS
              ? 'Tap Share → "Add to Home Screen"'
              : 'Install for quick access and notifications'
            }
          </p>
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-black rounded-lg"
            >
              Install Now
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;