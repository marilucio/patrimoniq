"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { FeedbackBanner, InputField } from "../../components/form-controls";
import { apiRequest, readApiError, type AuthSessionResponse } from "../../lib/api";

export function LoginClientPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("motivo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const infoMessage =
    reason === "sessao-expirada"
      ? "Sua sessao expirou. Entre novamente para continuar."
      : reason === "senha-redefinida"
        ? "Senha atualizada com sucesso. Entre com a nova credencial."
        : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void apiRequest<AuthSessionResponse>("/auth/login", {
        method: "POST",
        body: {
          email,
          password
        }
      })
        .then(() => {
          window.location.assign("/dashboard");
        })
        .catch((submitError) => {
          setError(readApiError(submitError));
        });
    });
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <span className="eyebrow">Acesso seguro</span>
        <h1>Entrar na sua conta</h1>
        <p>
          Acesse seu painel financeiro com sessao protegida.
        </p>
      </div>

      <form className="editor-form" onSubmit={handleSubmit} aria-label="Formulario de login">
        <InputField
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          aria-label="E-mail"
        />
        <InputField
          label="Senha"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          aria-label="Senha"
        />

        {infoMessage ? <FeedbackBanner tone="info" message={infoMessage} /> : null}
        {error ? <FeedbackBanner tone="error" message={error} /> : null}

        <div className="form-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Entrando..." : "Entrar"}
          </button>
          <Link href="/forgot-password" className="inline-link">
            Esqueci a senha
          </Link>
          <Link href="/register" className="inline-link">
            Criar conta
          </Link>
        </div>
      </form>

      <div className="auth-card-footer">
        <p>
          Ainda nao tem conta?{" "}
          <Link href="/register" className="inline-link">Criar agora</Link>
        </p>
      </div>
    </section>
  );
}
