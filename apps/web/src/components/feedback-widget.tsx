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
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "UX", label: "Experiencia" },
  { value: "OTHER", label: "Outro" }
];

export function FeedbackWidget() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("OTHER");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function resetForm() {
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
          pagePath: pathname
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
      >
        Feedback beta
      </button>

      {isOpen ? (
        <section id="feedback-panel" className="feedback-panel">
          <div className="feedback-panel-header">
            <div>
              <span className="eyebrow">Feedback</span>
              <h3>Como foi esta tela?</h3>
              <p>Seu relato vai com o contexto da pagina atual para acelerar a correcao.</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleClose}>
              Fechar
            </button>
          </div>

          <form className="editor-form" onSubmit={handleSubmit}>
            <SelectField
              label="Categoria"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={feedbackCategories}
            />
            <TextAreaField
              label="Relato"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              hint="Explique o que aconteceu, o que voce esperava e, se der, como reproduzir."
              placeholder="Ex.: Na tela de transacoes, eu esperava..."
              required
            />

            {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

            <FormActions
              submitLabel="Enviar feedback"
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
