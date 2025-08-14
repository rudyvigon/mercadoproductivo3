"use client";

import React from "react";
import { createRoot } from "react-dom/client";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

function Dialog({
  open,
  title = "¿Salir sin guardar?",
  description = "Tienes cambios sin guardar. Si sales, se perderán.",
  confirmText = "Salir sin guardar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-[1001] w-[92vw] max-w-md rounded-lg bg-white shadow-xl border">
        <div className="p-5">
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-sm text-gray-600 mb-5">{description}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium bg-white hover:bg-gray-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Imperative confirm modal that returns a Promise<boolean>
export default function confirmModal(options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return new Promise((resolve) => {
    const cleanup = () => {
      try {
        root.unmount();
      } catch {}
      container.remove();
    };

    const handleConfirm = () => {
      resolve(true);
      cleanup();
    };
    const handleCancel = () => {
      resolve(false);
      cleanup();
    };

    root.render(
      <Dialog
        open={true}
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  });
}
