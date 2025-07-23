import React from 'react';
import { usePWAInstallPrompt } from '../hooks/usePWAInstallPrompt';
import { Button } from './ui/Button';
import { Download } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, triggerInstall } = usePWAInstallPrompt();

  if (!isInstallable) {
    return null;
  }

  return (
    <div className="p-4 bg-blue-100 border-t-4 border-blue-500 rounded-b text-blue-900 shadow-lg">
      <div className="flex items-center">
        <Download className="w-6 h-6 mr-3 text-blue-500" />
        <div>
          <p className="font-bold">Instale o aplicativo</p>
          <p className="text-sm">Adicione nosso app à sua tela inicial para uma experiência mais rápida e offline.</p>
        </div>
        <Button onClick={triggerInstall} className="ml-auto bg-blue-500 hover:bg-blue-600">
          Instalar
        </Button>
      </div>
    </div>
  );
};