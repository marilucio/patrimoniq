import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { AppShell } from "../components/app-shell";
import { ToastProvider } from "../components/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patrimoniq",
  description: "Controle financeiro individual com clareza e inteligencia pratica"
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
