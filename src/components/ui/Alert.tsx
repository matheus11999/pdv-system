import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number; // Auto close duration in ms
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  isVisible,
  onClose,
  duration = 4000
}) => {
  React.useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getAlertConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          iconColor: 'text-green-600',
          titleColor: 'text-green-800',
          textColor: 'text-green-700'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          textColor: 'text-yellow-700'
        };
      case 'error':
        return {
          icon: XCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          textColor: 'text-red-700'
        };
      case 'info':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          textColor: 'text-blue-700'
        };
    }
  };

  const config = getAlertConfig();
  const IconComponent = config.icon;

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full animate-in slide-in-from-top-2 duration-300">
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-lg`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <IconComponent className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="ml-3 flex-1">
            {title && (
              <h3 className={`text-sm font-medium ${config.titleColor} mb-1`}>
                {title}
              </h3>
            )}
            <p className={`text-sm ${config.textColor} whitespace-pre-line`}>
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={onClose}
              className={`inline-flex rounded-md ${config.bgColor} ${config.textColor} hover:${config.titleColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600`}
            >
              <span className="sr-only">Fechar</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook para gerenciar alertas
export const useAlert = () => {
  const [alerts, setAlerts] = React.useState<Array<{
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    title?: string;
    message: string;
    duration?: number;
  }>>([]);

  const showAlert = (
    type: 'success' | 'warning' | 'error' | 'info',
    message: string,
    title?: string,
    duration?: number
  ) => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { id, type, title, message, duration }]);
  };

  const hideAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const success = (message: string, title?: string, duration?: number) => 
    showAlert('success', message, title, duration);

  const warning = (message: string, title?: string, duration?: number) => 
    showAlert('warning', message, title, duration);

  const error = (message: string, title?: string, duration?: number) => 
    showAlert('error', message, title, duration);

  const info = (message: string, title?: string, duration?: number) => 
    showAlert('info', message, title, duration);

  return {
    alerts,
    showAlert,
    hideAlert,
    success,
    warning,
    error,
    info
  };
};

// Componente de container para renderizar alertas
export const AlertContainer: React.FC = () => {
  const { alerts, hideAlert } = useAlert();

  return (
    <>
      {alerts.map((alert, index) => (
        <div
          key={alert.id}
          style={{ top: `${1 + index * 5}rem` }}
          className="fixed right-4 z-[9999]"
        >
          <Alert
            type={alert.type}
            title={alert.title}
            message={alert.message}
            isVisible={true}
            onClose={() => hideAlert(alert.id)}
            duration={alert.duration}
          />
        </div>
      ))}
    </>
  );
};