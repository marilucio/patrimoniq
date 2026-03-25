"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { FeedbackBanner, FormActions, SelectField, TextAreaField } from "./form-controls";
import { useToast } from "./toast-provider";
import { apiRequest, readApiError } from "../lib/api";
import { notifyDataChanged } from "../lib/live-data";

const feedbackCategories = [
  { value: "BUG", label: "Bug" },
  { value: "IDEA", label: "Ideia" },
  { value: "ONBOARDING", label: "Primeiros passos" },
  { value: "UX", label: "Experiencia" },
  { value: "OTHER", label: "Outro" }
];

const sentimentOptions = [
  { value: "positive", label: "Gostei", icon: "+" },
  { value: "neutral", label: "Neutro", icon: "~" },
  { value: "negative", label: "Problema", icon: "-" }
];

function pageLabel(pathname: string): string {
  const labels: Record<string, string> = {
    "/dashboard": "Visao geral",
    "/transactions": "Lancamentos",
    "/budgets": "Orcamentos",
    "/goals": "Metas",
    "/net-worth": "Patrimonio",
    "/reports": "Relatorios",
    "/settings": "Configuracoes"
  };
  return labels[pathname] ?? pathname;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [category, setCategory] = useState("OTHER");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setSentiment(null);
    setCategory("OTHER");
    setMessage("");
    setFeedback(null);
  }

  function handleClose() {
    setIsOpen(false);
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void apiRequest<{ success: boolean; message: string }>("/feedback", {
        method: "POST",
        body: {
          category,
          message,
          pagePath: pathname,
          ...(sentiment ? { sentiment } : {})
        }
      })
        .then((result) => {
          resetForm();
          notifyDataChanged();
          setIsOpen(false);
          showToast({ tone: "success", message: result.message });
        })
        .catch((submitError) => {
          const nextMessage = readApiError(submitError);
          setFeedback({ tone: "error", message: nextMessage });
          showToast({ tone: "error", message: nextMessage });
        });
    });
  }

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="feedback-panel"
        aria-label="Enviar feedback"
      >
        Feedback
      </button>

      {isOpen ? (
        <section
          id="feedback-panel"
          className="feedback-panel"
          role="dialog"
          aria-label="Enviar feedback"
        >
          <div className="feedback-panel-header">
            <div>
              <span className="eyebrow">Feedback</span>
              <h3>Como esta sua experiencia?</h3>
            </div>
            <button type="button" className="ghost-button" onClick={handleClose}>
              Fechar
            </button>
          </div>

          <div className="feedback-context">
            Pagina: <strong>{pageLabel(pathname)}</strong>
          </div>

          <div className="sentiment-row" role="radiogroup" aria-label="Sentimento">
            {sentimentOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  sentiment === option.value
                    ? "sentiment-button selected"
                    : "sentiment-button"
                }
                onClick={() => setSentiment(option.value)}
                aria-pressed={sentiment === option.value}
              >
                <span className="sentiment-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <form className="editor-form" onSubmit={handleSubmit} aria-label="Formulario de feedback">
            <SelectField
              label="Tipo"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={feedbackCategories}
            />
            <TextAreaField
              label="Relato"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              hint="O que aconteceu? O que voce esperava?"
              placeholder="Descreva brevemente..."
              required
            />

            {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

            <FormActions
              submitLabel="Enviar"
              cancelLabel="Agora nao"
              onCancel={handleClose}
              pending={isPending}
            />
          </form>
        </section>
      ) : null}
    </>
  );
}
