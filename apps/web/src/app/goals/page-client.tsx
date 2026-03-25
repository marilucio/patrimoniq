"use client";

import { calculateGoalProgress, formatCurrency } from "@patrimoniq/domain";
import { useState, useTransition } from "react";
import { EmptyModuleState, ErrorState, LoadingState } from "../../components/page-state";
import { FeedbackBanner, FormActions, InputField, SelectField, TextAreaField } from "../../components/form-controls";
import { useToast } from "../../components/toast-provider";
import { EmptyState, PageIntro, ProgressBar, SectionCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import { apiRequest, readApiError, type GoalsResponse } from "../../lib/api";
import { notifyDataChanged } from "../../lib/live-data";
import { goalKindOptions, goalPriorityOptions, humanizeEnum } from "../../lib/options";
import { parsePositiveAmount, validateIsoDate } from "../../lib/validation";

const emptyGoalForm = {
  name: "",
  kind: "EMERGENCY_FUND",
  priority: "HIGH",
  targetAmount: "",
  currentAmount: "",
  monthlyContributionTarget: "",
  targetDate: "",
  notes: ""
};

export function GoalsClientPage() {
  const goals = useApiResource<GoalsResponse>("/goals");
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyGoalForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setForm(emptyGoalForm);
    setEditingId(null);
  }

  function loadGoalIntoForm(goal: GoalsResponse["items"][number]) {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      kind: goal.kindCode,
      priority: goal.priorityCode,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      monthlyContributionTarget: String(goal.monthlyTarget),
      targetDate: goal.targetDate,
      notes: goal.notes ?? ""
    });
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const targetAmountResult = parsePositiveAmount(form.targetAmount, "Valor alvo");
    if (targetAmountResult.error) {
      setFeedback({ tone: "error", message: targetAmountResult.error });
      showToast({ tone: "error", message: targetAmountResult.error });
      return;
    }

    if (form.targetDate) {
      const dateError = validateIsoDate(form.targetDate, "Data alvo");
      if (dateError) {
        setFeedback({ tone: "error", message: dateError });
        showToast({ tone: "error", message: dateError });
        return;
      }
    }

    startTransition(() => {
      void apiRequest(editingId ? `/goals/${editingId}` : "/goals", {
        method: editingId ? "PATCH" : "POST",
        body: {
          name: form.name,
          kind: form.kind,
          priority: form.priority,
          targetAmount: targetAmountResult.value,
          ...(form.currentAmount ? { currentAmount: Number(form.currentAmount) } : {}),
          ...(form.monthlyContributionTarget ? { monthlyContributionTarget: Number(form.monthlyContributionTarget) } : {}),
          ...(form.targetDate ? { targetDate: form.targetDate } : {}),
          ...(form.notes ? { notes: form.notes } : {})
        }
      })
        .then(async () => {
          await goals.reload();
          notifyDataChanged();
          const message = editingId ? "Meta atualizada." : "Meta criada.";
          setFeedback({ tone: "success", message });
          showToast({ tone: "success", message });
          resetForm();
        })
        .catch((submitError) => {
          const message = readApiError(submitError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function handleArchive(id: string) {
    if (!window.confirm("Cancelar esta meta?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/goals/${id}`, { method: "DELETE" })
        .then(async () => {
          await goals.reload();
          notifyDataChanged();
          if (editingId === id) {
            resetForm();
          }
          showToast({ tone: "success", message: "Meta cancelada." });
        })
        .catch((submitError) => {
          showToast({ tone: "error", message: readApiError(submitError) });
        });
    });
  }

  if (goals.loading) {
    return <LoadingState />;
  }

  if (goals.error || !goals.data) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Metas indisponiveis"
          description={goals.error ?? "Nao foi possivel carregar suas metas."}
        />
      </div>
    );
  }

  if (goals.data.items.length === 0 && !editingId) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Metas"
          title="Nenhuma meta ativa"
          description="Crie uma meta para acompanhar seu progresso."
        />
        <div className="two-column">
          <SectionCard title="Nova meta" subtitle="Defina seu primeiro objetivo">
            <form className="editor-form" onSubmit={handleSubmit}>
              <InputField label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <InputField label="Valor alvo" type="number" min="0" step="0.01" value={form.targetAmount} onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))} required />
              <FormActions submitLabel="Criar meta" pending={isPending} />
              {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}
            </form>
          </SectionCard>
          <EmptyModuleState
            title="Sem metas registradas"
            description="Crie uma meta para acompanhar prazo e progresso."
            cta="Comecar agora"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Metas"
        title="Suas metas"
        description="Acompanhe o progresso dos seus objetivos financeiros."
      />

      <div className="two-column">
        <SectionCard title={editingId ? "Editar meta" : "Nova meta"} subtitle="Cadastro simples e bem distribuido">
          <form className="editor-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <InputField label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <SelectField label="Tipo" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))} options={goalKindOptions.map((option) => ({ value: option, label: humanizeEnum(option) }))} />
              <SelectField label="Prioridade" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} options={goalPriorityOptions.map((option) => ({ value: option, label: humanizeEnum(option) }))} />
              <InputField label="Valor alvo" type="number" min="0" step="0.01" value={form.targetAmount} onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))} required />
              <InputField label="Acumulado atual" type="number" min="0" step="0.01" value={form.currentAmount} onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))} />
              <InputField label="Aporte mensal alvo" type="number" min="0" step="0.01" value={form.monthlyContributionTarget} onChange={(event) => setForm((current) => ({ ...current, monthlyContributionTarget: event.target.value }))} />
              <InputField label="Data alvo" type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} />
            </div>

            <TextAreaField label="Notas" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

            {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

            <FormActions
              submitLabel={editingId ? "Salvar alteracoes" : "Criar meta"}
              cancelLabel={editingId ? "Cancelar edicao" : undefined}
              onCancel={editingId ? resetForm : undefined}
              pending={isPending}
            />
          </form>
        </SectionCard>

        <SectionCard title="Suas metas" subtitle="Metas ativas e em andamento">
          <div className="stack-list">
            {goals.data.items.map((goal) => (
              <div key={goal.id} className="stack-row">
                <div className="stack-head">
                  <strong>{goal.name}</strong>
                  <span>{goal.priority}</span>
                </div>
                <ProgressBar value={calculateGoalProgress(goal)} tone={goal.priorityCode === "CRITICAL" ? "positive" : "default"} />
                <p>
                  {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)} · meta mensal {formatCurrency(goal.monthlyTarget)}
                </p>
                <div className="list-actions">
                  <button type="button" className="ghost-button" onClick={() => loadGoalIntoForm(goal)}>
                    Editar
                  </button>
                  <button type="button" className="danger-button" onClick={() => handleArchive(goal.id)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Simulacoes" subtitle="Cenarios que podem acelerar suas metas">
        {goals.data.simulations.length === 0 ? (
          <EmptyState title="Sem simulacoes disponiveis" description="Simulacoes aparecem conforme seu historico cresce." cta="Continue registrando" />
        ) : (
          <div className="stack-list">
            {goals.data.simulations.map((simulation) => (
              <div key={simulation.id} className="stack-row">
                <div className="stack-head">
                  <strong>{simulation.label}</strong>
                  <span>{simulation.impact}</span>
                </div>
                <p>{simulation.outcome}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
