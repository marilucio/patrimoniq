"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FeedbackBanner, InputField } from "../../components/form-controls";
import { apiRequest, readApiError, type AuthSessionResponse } from "../../lib/api";

export function RegisterClientPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("As senhas digitadas nao coincidem.");
      return;
    }

    startTransition(() => {
      void apiRequest<AuthSessionResponse>("/auth/register", {
        method: "POST",
        body: {
          fullName: form.fullName,
          email: form.email,
          password: form.password
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
        <span className="eyebrow">Primeiro acesso</span>
        <h1>Criar conta</h1>
        <p>
          Crie sua conta para comecar a organizar suas financas.
        </p>
      </div>

      <form className="editor-form" onSubmit={handleSubmit} aria-label="Formulario de cadastro">
        <InputField
          label="Nome completo"
          value={form.fullName}
          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
          required
          autoComplete="name"
        />
        <InputField
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          required
          autoComplete="email"
        />
        <InputField
          label="Senha"
          type="password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          hint="Minimo de 8 caracteres."
          required
          autoComplete="new-password"
        />
        <InputField
          label="Confirmar senha"
          type="password"
          value={form.confirmPassword}
          onChange={(event) =>
            setForm((current) => ({ ...current, confirmPassword: event.target.value }))
          }
          required
          autoComplete="new-password"
        />

        {error ? <FeedbackBanner tone="error" message={error} /> : null}

        <div className="form-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Criando..." : "Criar conta"}
          </button>
          <Link href="/login" className="inline-link">
            Ja tenho conta
          </Link>
        </div>
      </form>
    </section>
  );
}
