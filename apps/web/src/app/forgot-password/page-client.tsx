"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FeedbackBanner, InputField } from "../../components/form-controls";
import { apiRequest, readApiError } from "../../lib/api";

export function ForgotPasswordClientPage() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void apiRequest<{ success: boolean; message: string }>("/auth/password/forgot", {
        method: "POST",
        body: { email }
      })
        .then((response) => {
          setFeedback({ tone: "success", message: response.message });
        })
        .catch((submitError) => {
          setFeedback({ tone: "error", message: readApiError(submitError) });
        });
    });
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <span className="eyebrow">Recuperacao</span>
        <h1>Recuperar senha</h1>
        <p>
          Informe seu e-mail para receber um link seguro e temporario de redefinicao. Se nao
          chegar em poucos minutos, revise spam e lixo eletronico.
        </p>
      </div>

      <form className="editor-form" onSubmit={handleSubmit}>
        <InputField
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

        <div className="form-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar link"}
          </button>
          <Link href="/login" className="inline-link">
            Voltar ao login
          </Link>
        </div>
      </form>
    </section>
  );
}
