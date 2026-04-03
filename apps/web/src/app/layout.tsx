import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { AppShell } from "../components/app-shell";
import { ServiceWorkerRegister } from "../components/sw-register";
import { ToastProvider } from "../components/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patrimoniq",
  description:
    "Controle financeiro individual com clareza e inteligencia pratica",
  applicationName: "Patrimoniq",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b132b",
  icons: {
    icon: "/icons/logo_app.jpg",
    apple: "/icons/logo_app.jpg",
  },
  appleWebApp: {
    capable: true,
    title: "Patrimoniq",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <AppShell>
            <ServiceWorkerRegister />
            {children}
          </AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
