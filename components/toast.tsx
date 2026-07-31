"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Kind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const ToastContext = createContext<(kind: Kind, text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STYLES: Record<Kind, string> = {
  info: "border-hairline bg-surface text-ink",
  success: "border-good/40 bg-surface text-ink",
  error: "border-critical/40 bg-surface text-ink",
};

const DOTS: Record<Kind, string> = {
  info: "bg-accent",
  success: "bg-good",
  error: "bg-critical",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }].slice(-4));
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      kind === "error" ? 6000 : 3500
    );
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg animate-[toast-in_.18s_ease-out] ${STYLES[t.kind]}`}
          >
            <span
              aria-hidden
              className={`mt-1.5 size-2 shrink-0 rounded-full ${DOTS[t.kind]}`}
            />
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
