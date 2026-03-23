"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { navigation } from "../lib/navigation";
import { FeedbackWidget } from "./feedback-widget";
import { LogoutButton } from "./logout-button";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const authRoutes = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
  const currentMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(new Date());

  if (authRoutes.has(pathname)) {
    return (
      <div className="auth-screen">
        <div className="auth-shell-brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>Patrimoniq</strong>
            <p>Financas pessoais com clareza, beleza e verdade.</p>
          </div>
        </div>
        <main className="auth-screen-content">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>Patrimoniq</strong>
            <p>Controle financeiro individual</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacao principal">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-link active" : "nav-link"}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </Link>
            );
          })}
        </nav>

        <section className="method-card">
          <span className="eyebrow">Metodo</span>
          <h3>Ver. Ajustar. Proteger. Crescer.</h3>
          <ol>
            <li>Ver a realidade do mes</li>
            <li>Reduzir vazamentos</li>
            <li>Proteger a reserva</li>
            <li>Quitar dividas caras</li>
            <li>Investir com constancia</li>
          </ol>
        </section>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">Financas pessoais</span>
            <h1>Seu dinheiro com clareza e menos ruido</h1>
          </div>

          <div className="topbar-actions">
            <div className="pill">{currentMonth}</div>
            <LogoutButton />
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>

      <FeedbackWidget />
    </div>
  );
}
