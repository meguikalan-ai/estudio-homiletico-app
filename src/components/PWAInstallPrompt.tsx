import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if app is already installed in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture standard PWA install prompt (Chrome / Android / Edge / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
      console.log('[PWA] Aplicativo instalado com sucesso!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers where beforeinstallprompt was already dismissed or unavailable
      alert('Para instalar o aplicativo no seu dispositivo:\n\n1. No Chrome/Edge: Clique nos 3 pontinhos do navegador e selecione "Instalar Aplicativo" ou "Adicionar à Tela Inicial".\n2. No Safari (iOS): Toque no botão de Compartilhar e escolha "Adicionar à Tela de Início".');
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Top Bar / Header Install Button */}
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1 bg-[#C8B27A]/20 hover:bg-[#C8B27A]/30 text-[#E6E2DA] hover:text-white rounded-full border border-[#C8B27A]/40 text-[11px] font-bold transition-all cursor-pointer shadow-xs"
        title="Instalar Estúdio Homilético no Celular ou Computador"
      >
        <Download className="w-3.5 h-3.5 text-[#C8B27A]" />
        <span>Instalar App</span>
      </button>

      {/* Floating Bottom Prompt for First-Time Mobile Visitors */}
      {showBanner && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 bg-[#2D2926] text-white p-4 rounded-2xl shadow-2xl border border-[#5A5A40]/40 z-50 animate-fade-in flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shrink-0 shadow-md">
                <Smartphone className="w-5 h-5 text-[#C8B27A]" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#E6E2DA]">Instalar Aplicativo</h4>
                <p className="text-[11px] text-gray-300">Acesse o Estúdio Homilético direto da sua tela inicial offline.</p>
              </div>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 bg-[#5A5A40] hover:bg-[#4a4a33] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Adicionar à Tela Inicial</span>
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="py-2 px-3 bg-white/10 hover:bg-white/15 text-gray-300 rounded-xl text-xs font-medium cursor-pointer transition-all"
            >
              Depois
            </button>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-[#2D2926] shadow-2xl border border-[#E5E0D8] space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#5A5A40]" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2D2926]">Instalar no iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              No Safari do iOS, siga estes 2 passos rápidos para fixar o aplicativo na sua tela de início:
            </p>

            <div className="space-y-3 bg-[#FAF9F6] p-3.5 rounded-xl border border-gray-200 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-gray-700">
                  Toque no ícone de <strong>Compartilhar</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> na barra inferior do Safari.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-gray-700">
                  Role o menu e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-gray-700" />.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-[#5A5A40] hover:bg-[#4a4a33] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
