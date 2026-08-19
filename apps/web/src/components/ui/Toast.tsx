import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4500 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message, duration: 6000 }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconClass: 'text-[#00D09C]',
          bgClass: 'bg-white border-emerald-200 shadow-lg shadow-emerald-500/10',
          badgeClass: 'bg-emerald-50 text-[#008f6b] border-emerald-200',
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconClass: 'text-rose-500',
          bgClass: 'bg-white border-rose-200 shadow-lg shadow-rose-500/10',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconClass: 'text-amber-500',
          bgClass: 'bg-white border-amber-200 shadow-lg shadow-amber-500/10',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconClass: 'text-sky-500',
          bgClass: 'bg-white border-sky-200 shadow-lg shadow-sky-500/10',
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Floating Responsive Toast Container (Top-Right on Desktop, Top-Center on Mobile) */}
      <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 flex flex-col gap-2 max-w-[92vw] sm:max-w-md w-full pointer-events-none">
        {toasts.map((t) => {
          const { icon: Icon, iconClass, bgClass } = getToastStyles(t.type);
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border ${bgClass} transition-all duration-300 transform translate-y-0 opacity-100 animate-slideDown shadow-xl`}
            >
              <div className="shrink-0 mt-0.5">
                <Icon className={`w-5 h-5 ${iconClass} stroke-[2.5]`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                  {t.title}
                </h4>
                {t.message && (
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5 leading-relaxed break-words">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
