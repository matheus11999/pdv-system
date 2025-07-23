import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS PWA
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Show prompt immediately for testing, then after 5 seconds for production
      setTimeout(() => {
        if (!localStorage.getItem('pwa-prompt-dismissed')) {
          console.log('Showing PWA install prompt');
          setShowPrompt(true);
        } else {
          console.log('PWA prompt was dismissed, not showing');
        }
      }, 5000); // Reduced from 30s to 5s for better UX
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Fallback: If no beforeinstallprompt event is fired after 10 seconds, show anyway
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled && !localStorage.getItem('pwa-prompt-dismissed')) {
        console.log('No beforeinstallprompt event detected, showing fallback prompt');
        setShowPrompt(true);
      }
    }, 10000);

    // Test timer: Show prompt after 3 seconds for immediate testing
    const testTimer = setTimeout(() => {
      if (!localStorage.getItem('pwa-prompt-dismissed')) {
        console.log('Test prompt showing');
        setShowPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
      clearTimeout(testTimer);
    };
  }, []);

  const handleInstall = async () => {
    console.log('Install button clicked, deferredPrompt:', !!deferredPrompt);
    
    if (!deferredPrompt) {
      // For iOS Safari, show instructions
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        alert('Para instalar: Toque no botão "Compartilhar" (ícone de compartilhamento) na parte inferior da tela e selecione "Adicionar à Tela de Início"');
        setShowPrompt(false);
        return;
      }
      
      // For other browsers without native support, show manual instructions
      alert('Para instalar como aplicativo:\n\n' +
            'Chrome: Menu → Instalar aplicativo\n' +
            'Edge: Menu → Aplicativos → Instalar este site como aplicativo\n' +
            'Firefox: Menu → Adicionar à tela inicial');
      setShowPrompt(false);
      return;
    }

    try {
      console.log('Attempting to show install prompt');
      const promptResult = await deferredPrompt.prompt();
      console.log('Prompt result:', promptResult);
      
      const choiceResult = await deferredPrompt.userChoice;
      console.log('User choice:', choiceResult.outcome);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA instalação aceita pelo usuário');
        setIsInstalled(true);
      } else {
        console.log('PWA instalação rejeitada pelo usuário');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Erro ao tentar instalar PWA:', error);
      // Even if error, hide the prompt
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    
    // Show again in 7 days
    setTimeout(() => {
      localStorage.removeItem('pwa-prompt-dismissed');
    }, 7 * 24 * 60 * 60 * 1000);
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Instalar PDV System</h3>
            <p className="text-xs text-gray-600">Acesse rapidamente como app</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
        Instale o app para acesso rápido, trabalhar offline e receber notificações.
      </p>
      
      <div className="flex gap-2">
        <Button
          onClick={handleInstall}
          size="sm"
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Instalar
        </Button>
        <Button
          onClick={handleDismiss}
          variant="secondary"
          size="sm"
          className="px-3"
        >
          Agora não
        </Button>
      </div>
      
      {/* Debug button - remove in production */}
      <button
        onClick={() => {
          localStorage.removeItem('pwa-prompt-dismissed');
          console.log('PWA dismissed flag cleared');
        }}
        className="text-xs text-gray-400 hover:text-gray-600 mt-2"
        style={{ fontSize: '10px' }}
      >
        [Debug: Reset prompt]
      </button>
    </div>
  );
};

// CSS Animation for slide up
const styles = `
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}