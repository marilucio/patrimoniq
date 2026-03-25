"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type PropsWithChildren } from "react";
import { useApiResource } from "../hooks/use-api-resource";
import type { AuthSessionResponse } from "../lib/api";
import { navigation } from "../lib/navigation";
import { FeedbackWidget } from "./feedback-widget";
import { LogoutButton } from "./logout-button";

function UserGreeting() {
  const session = useApiResource<AuthSessionResponse>("/auth/me");
  const label = session.data?.user?.fullName ?? session.data?.user?.email ?? null;

  if (!label) {
    return null;
  }

  return <span className="user-greeting">{label}</span>;
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className={`app-shell ${mobileMenuOpen ? "menu-open" : ""}`}>
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
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
          <button
            type="button"
            className="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label="Abrir menu de navegacao"
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
          <div>
            <span className="eyebrow">Financas pessoais</span>
            <h1>Seu dinheiro com clareza e menos ruido</h1>
          </div>

          <div className="topbar-actions">
            <UserGreeting />
            <div className="pill">{currentMonth}</div>
            <LogoutButton />
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
      {mobileMenuOpen ? (
        <button
          type="button"
          className="mobile-sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <FeedbackWidget />
    </div>
  );
}
