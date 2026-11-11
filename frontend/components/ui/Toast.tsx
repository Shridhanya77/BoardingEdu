"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastVariant = "info" | "success" | "warn" | "danger";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcon = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
} as const;

const variantClass: Record<ToastVariant, string> = {
  info: "",
  success: "be-toast--success",
  warn: "be-toast--warn",
  danger: "be-toast--danger",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="be-toast-container" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = variantIcon[t.variant];
          return (
            <div key={t.id} className={`be-toast ${variantClass[t.variant]}`.trim()} role="status">
              <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span className="be-toast__msg">{t.message}</span>
              <button
                type="button"
                className="be-toast__close"
                onClick={() => remove(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so the hook is safe to use outside the provider (e.g. during SSR).
    return { toast: () => undefined };
  }
  return ctx;
};

export default ToastProvider;
