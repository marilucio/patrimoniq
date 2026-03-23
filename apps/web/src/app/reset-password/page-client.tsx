"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { FeedbackBanner, InputField } from "../../components/form-controls";
import { apiRequest, readApiError } from "../../lib/api";

export function ResetPasswordClientPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!token) {
      setFeedback({ tone: "error", message: "O link de redefinicao esta incompleto." });
      return;
    }

    if (password.length < 8) {
      setFeedback({ tone: "error", message: "A nova senha precisa ter pelo menos 8 caracteres." });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ tone: "error", message: "As senhas digitadas nao coincidem." });
      return;
    }

    startTransition(() => {
      void apiRequest<{ success: boolean; message: string }>("/auth/password/reset", {
        method: "POST",
        body: {
          token,
          password
        }
      })
        .then((response) => {
          setFeedback({ tone: "success", message: response.message });
          setPassword("");
          setConfirmPassword("");
          window.setTimeout(() => {
            window.location.assign("/login?motivo=senha-redefinida");
          }, 1200);
        })
        .catch((submitError) => {
          setFeedback({ tone: "error", message: readApiError(submitError) });
        });
    });
  }

  return (
    <section className="auth-card">
      <div className="auth-card-header">
        <span className="eyebrow">Nova senha</span>
        <h1>Definir nova senha</h1>
        <p>
          Crie uma nova senha forte para voltar a acessar sua conta com seguranca. O link expira
          automaticamente para evitar reutilizacao indevida.
        </p>
      </div>

      <form className="editor-form" onSubmit={handleSubmit}>
        <InputField
          label="Nova senha"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <InputField
          label="Confirmar nova senha"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

        <div className="form-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>
          <Link href="/login" className="inline-link">
            Voltar ao login
          </Link>
        </div>
      </form>
    </section>
  );
}
