import React, { useState, useRef, useEffect } from 'react';
import { QrCode, X, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { playSound } from '../utils/sound';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const cleanupCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    cleanupCamera();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupCamera();
      return;
    }

    const initializeCamera = async () => {
      setIsLoading(true);
      setError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Seu navegador não suporta acesso à câmera.');
        setIsLoading(false);
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              console.error('Video play error:', err);
              setError('Não foi possível iniciar a câmera.');
              setIsLoading(false);
            });
          };
          videoRef.current.onplaying = () => {
            setIsLoading(false);
            setIsScanning(true);
          };
        }
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Permissão da câmera negada. Habilite nas configurações do navegador.');
        } else if (err.name === 'NotFoundError') {
          setError('Nenhuma câmera encontrada.');
        } else {
          setError('Erro ao iniciar a câmera.');
        }
        setIsLoading(false);
      }
    };

    initializeCamera();

    return () => {
      cleanupCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isScanning || !('BarcodeDetector' in window)) return;

    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'codabar', 'code_128', 'qr_code'] });
    let animationFrameId: number;

    const detectBarcode = async () => {
      if (videoRef.current && videoRef.current.readyState > 1) {
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            playSound('/scan-sound.mp3');
            onScan(barcodes[0].rawValue);
            handleClose();
          }
        } catch (err) {
          console.error('Barcode detection error:', err);
        }
      }
      animationFrameId = requestAnimationFrame(detectBarcode);
    };

    detectBarcode();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isScanning, onScan, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center">
            <QrCode className="w-6 h-6 mr-2" />
            <div>
              <h3 className="text-lg font-bold">Scanner de Código</h3>
              <p className="text-blue-100 text-sm">Aponte para o código de barras</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-blue-800 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative bg-gray-900 rounded-xl overflow-hidden h-64 mb-4">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <Camera className="w-12 h-12 mb-2 animate-pulse" />
                <p>Iniciando câmera...</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <AlertCircle className="w-12 h-12 mb-2 text-red-400" />
                <p className="text-white mb-4">{error}</p>
                <Button onClick={() => window.location.reload()} size="sm" variant="secondary">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recarregar
                </Button>
              </div>
            )}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isLoading || error ? 'hidden' : 'block'}`}
              playsInline
              muted
            />
            {!isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-24 border-2 border-green-400 rounded-lg"/>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleClose} variant="secondary" className="flex-1">Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
};