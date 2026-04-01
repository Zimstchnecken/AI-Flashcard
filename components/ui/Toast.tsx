"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  kind?: "info" | "success" | "error";
  onClose: () => void;
};

export default function Toast({ message, kind = "info", onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  const borderClass =
    kind === "success"
      ? "border-[var(--success)]"
      : kind === "error"
        ? "border-[var(--error)]"
        : "border-primary";

  return (
    <div className={`fixed right-4 top-4 z-50 w-[min(360px,92vw)] animate-toast-in rounded-xl border bg-surface p-4 shadow-[var(--shadow-modal)] ${borderClass}`} role="status" aria-live="polite">
      <p className="text-sm text-text-primary">{message}</p>
    </div>
  );
}
