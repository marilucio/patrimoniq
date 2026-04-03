"use client";

import { useEffect, useState } from "react";

export function PwaInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  }

  if (installed) {
    return null;
  }

  return canInstall ? (
    <button
      type="button"
      className="primary-button"
      onClick={install}
      aria-label="Instalar aplicativo"
    >
      Instalar aplicativo
    </button>
  ) : null;
}
