// PopupNotification.jsx
"use client";
import React, { useState, useEffect } from 'react';

interface PopupNotificationProps {
  message: string;
  type: 'error' | 'success' | 'info';
  isOpen: boolean;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

const PopupNotification: React.FC<PopupNotificationProps> = ({ message, type, isOpen, onClose, autoClose = true, duration = 4000 }) => {
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    setIsVisible(isOpen);
    
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' :
                  type === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
                  'bg-blue-100 border-blue-400 text-blue-700';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
      <div className={`rounded-lg shadow-lg p-6 max-w-md ${bgColor} border-l-4 relative`}>
        <button 
          onClick={() => {
            setIsVisible(false);
            if (onClose) onClose();
          }}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
        >
          ×
        </button>
        <p className="text-center">{message}</p>
      </div>
    </div>
  );
};

export default PopupNotification;