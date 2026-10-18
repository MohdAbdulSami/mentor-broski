import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA install');
      }
      setDeferredPrompt(null);
      setIsVisible(false);
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-between gap-4 animate-slideUp">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-broski-yellow text-slate-900 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
          MB
        </div>
        <div>
          <h4 className="font-bold text-white text-xs">Install Mentor Broski App</h4>
          <p className="text-[11px] text-slate-400">Access your AI career mentor directly from your home screen.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg btn-broski-primary text-xs flex items-center gap-1.5 shadow-sm min-h-[44px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        <button
          onClick={() => setIsVisible(false)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
