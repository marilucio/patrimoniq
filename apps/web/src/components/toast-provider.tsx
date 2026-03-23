"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{
  showToast: (toast: Omit<ToastItem, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const value = useMemo(
    () => ({
      showToast(toast: Omit<ToastItem, "id">) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 4200);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.tone}`}>
            <div className="toast-header">
              <strong>
                {toast.tone === "success"
                  ? "Tudo certo"
                  : toast.tone === "error"
                    ? "Algo precisa de atencao"
                    : "Aviso"}
              </strong>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              >
                Fechar
              </button>
            </div>
            <p>{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast precisa estar dentro de ToastProvider.");
  }

  return context;
}
