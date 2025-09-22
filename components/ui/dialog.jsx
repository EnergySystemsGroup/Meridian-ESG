import React from 'react';
import { createPortal } from 'react-dom';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}

export function DialogContent({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ className = '', children, ...props }) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ className = '', children, ...props }) {
  return (
    <h2 className={`text-lg font-semibold ${className}`} {...props}>
      {children}
    </h2>
  );
}