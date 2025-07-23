import React, { useState, useRef, useEffect } from 'react';
import { QrCode, X, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen && !stream) {
      initializeCamera();
    }
    
    return () => {
      if (stream) {
        cleanupCamera();
      }
    };
  }, [isOpen]);

  // Barcode detection loop
  useEffect(() => {
    let animationId: number;
    
    if (detectionActive && videoRef.current && canvasRef.current) {
      const detectBarcodes = async () => {
        try {
          if ('BarcodeDetector' in window) {
            // Use native Barcode Detection API if available
            const detector = new window.BarcodeDetector();
            const barcodes = await detector.detect(videoRef.current!);
            
            if (barcodes.length > 0) {
              const barcode = barcodes[0].rawValue;
              handleBarcodeDetected(barcode);
              return;
            }
          } else {
            // Fallback: Manual detection using canvas (simplified)
            await detectBarcodeManually();
          }
          
          // Continue detection
          animationId = requestAnimationFrame(detectBarcodes);
        } catch (err) {
          console.error('Detection error:', err);
          animationId = requestAnimationFrame(detectBarcodes);
        }
      };
      
      detectBarcodes();
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [detectionActive]);

  const initializeCamera = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Requesting camera access...');
      
      // Request camera permission with fallback constraints
      let constraints = {
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (backCameraError) {
        console.log('Back camera failed, trying front camera');
        // If back camera fails, try front camera
        constraints.video.facingMode = 'user';
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      console.log('Camera access granted, setting up video');
      setStream(mediaStream);
      setPermissionGranted(true);
      
      // Set video stream
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = mediaStream;
        
        // Force immediate loading end
        setTimeout(() => {
          console.log('Force setting loading to false');
          setIsLoading(false);
          setDetectionActive(true);
        }, 1000);
        
        // Multiple event listeners for different scenarios
        video.onloadeddata = () => {
          console.log('Video data loaded');
          setIsLoading(false);
          setDetectionActive(true);
        };
        
        video.oncanplay = () => {
          console.log('Video can play');
          setIsLoading(false);
          setDetectionActive(true);
        };
        
        video.onplaying = () => {
          console.log('Video is playing');
          setIsLoading(false);
          setDetectionActive(true);
        };
        
        // Try to play the video
        try {
          await video.play();
          console.log('Video play successful');
          setIsLoading(false);
          setDetectionActive(true);
        } catch (playError) {
          console.error('Video play failed:', playError);
          // Still proceed even if play fails
          setIsLoading(false);
          setDetectionActive(true);
        }
      }
      
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      setIsLoading(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Permissão para usar a câmera foi negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhuma câmera foi encontrada no dispositivo.');
      } else if (err.name === 'NotReadableError') {
        setError('Câmera está sendo usada por outro aplicativo.');
      } else {
        setError('Erro ao acessar a câmera: ' + err.message);
      }
    }
  };

  const detectBarcodeManually = async () => {
    // Simplified manual detection - in production, you'd use a library like ZXing
    // This is just a placeholder for demonstration
    return Promise.resolve();
  };

  const handleBarcodeDetected = (barcode: string) => {
    setDetectionActive(false);
    onScan(barcode);
    cleanupAndClose();
  };

  const cleanupCamera = () => {
    setDetectionActive(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const cleanupAndClose = () => {
    cleanupCamera();
    setPermissionGranted(false);
    setError('');
    onClose();
  };

  const handleManualInput = () => {
    const code = prompt('Digite o código de barras:');
    if (code && code.trim()) {
      onScan(code.trim());
      cleanupAndClose();
    }
  };

  const retryCamera = () => {
    cleanupCamera();
    initializeCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <QrCode className="w-6 h-6 mr-2" />
                <div>
                  <h3 className="text-lg font-bold">Scanner de Código</h3>
                  <p className="text-blue-100 text-sm">Posicione o código na câmera</p>
                </div>
              </div>
              <button
                onClick={cleanupAndClose}
                className="text-white hover:bg-blue-800 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Camera/Content Area */}
          <div className="p-4">
            <div className="relative bg-gray-900 rounded-xl overflow-hidden h-64 mb-4">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm">Inicializando câmera...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="text-center text-white">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                    <p className="text-sm mb-3">{error}</p>
                    <Button onClick={retryCamera} size="sm" variant="secondary">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              )}

              {permissionGranted && !error && (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  
                  {/* Scanner overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-24 border-2 border-green-400 rounded-lg">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400"></div>
                    </div>
                  </div>
                  
                  {detectionActive && (
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Procurando código...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Test buttons for development */}
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">Modo de desenvolvimento:</p>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleBarcodeDetected('7891234567890')}
                    className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    Código 1
                  </button>
                  <button
                    onClick={() => handleBarcodeDetected('1234567890123')}
                    className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                  >
                    Código 2
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={cleanupAndClose}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleManualInput}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Digitar Código
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};