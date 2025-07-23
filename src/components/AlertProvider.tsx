import React, { createContext, useContext, useState } from 'react';
import { Alert } from './ui/Alert';

interface AlertItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  message: string;
  duration?: number;
}

interface AlertContextType {
  showAlert: (type: 'success' | 'warning' | 'error' | 'info', message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const showAlert = (
    type: 'success' | 'warning' | 'error' | 'info',
    message: string,
    title?: string,
    duration?: number
  ) => {
    const id = Date.now().toString();
    const newAlert = { id, type, title, message, duration };
    setAlerts(prev => [...prev, newAlert]);
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

  return (
    <AlertContext.Provider value={{ showAlert, success, warning, error, info }}>
      {children}
      
      {/* Render alerts */}
      {alerts.map((alert, index) => (
        <div
          key={alert.id}
          style={{ top: `${1 + index * 6}rem` }}
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
    </AlertContext.Provider>
  );
};