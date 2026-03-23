"use client";

import { useTransition } from "react";
import { apiRequest } from "../lib/api";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => {
      void apiRequest("/auth/logout", {
        method: "POST"
      }).finally(() => {
        window.location.assign("/login");
      });
    });
  }

  return (
    <button type="button" className="ghost-button" onClick={handleLogout} disabled={isPending}>
      {isPending ? "Saindo..." : "Sair"}
    </button>
  );
}
