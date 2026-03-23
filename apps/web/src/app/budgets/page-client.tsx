"use client";

import { formatCurrency } from "@patrimoniq/domain";
import { useState, useTransition } from "react";
import { EmptyModuleState, ErrorState, LoadingState } from "../../components/page-state";
import { FeedbackBanner, FormActions, InputField, SelectField, TextAreaField } from "../../components/form-controls";
import { useToast } from "../../components/toast-provider";
import { PageIntro, ProgressBar, SectionCard, StatCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import { apiRequest, readApiError, type BudgetsResponse, type CategoriesResponse } from "../../lib/api";
import { notifyDataChanged } from "../../lib/live-data";
import { budgetCadenceOptions, humanizeEnum } from "../../lib/options";
import { parsePositiveAmount, validateDateRange } from "../../lib/validation";

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function monthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

const emptyBudgetForm = {
  name: "",
  amountLimit: "",
  periodStart: monthStart(),
  periodEnd: monthEnd(),
  cadence: "MONTHLY",
  categoryId: "",
  subcategoryId: "",
  alertThresholdPercent: "85",
  notes: ""
};

export function BudgetsClientPage() {
  const budgets = useApiResource<BudgetsResponse>("/budgets");
  const categories = useApiResource<CategoriesResponse>("/categories");
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyBudgetForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLoading = budgets.loading || categories.loading;
  const error = budgets.error ?? categories.error;
  const selectedCategory = categories.data?.items.find((item) => item.id === form.categoryId);

  function resetForm() {
    setForm(emptyBudgetForm);
    setEditingId(null);
  }

  function loadBudgetIntoForm(item: BudgetsResponse["items"][number]) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      amountLimit: String(item.planned),
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      cadence: item.cadenceCode,
      categoryId: item.categoryId ?? "",
      subcategoryId: item.subcategoryId ?? "",
      alertThresholdPercent: String(item.alertThresholdPercent),
      notes: item.notes ?? ""
    });
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const amountResult = parsePositiveAmount(form.amountLimit, "Limite");
    if (amountResult.error) {
      setFeedback({ tone: "error", message: amountResult.error });
      showToast({ tone: "error", message: amountResult.error });
      return;
    }

    const dateError = validateDateRange(form.periodStart, form.periodEnd);
    if (dateError) {
      setFeedback({ tone: "error", message: dateError });
      showToast({ tone: "error", message: dateError });
      return;
    }

    startTransition(() => {
      void apiRequest(editingId ? `/budgets/${editingId}` : "/budgets", {
        method: editingId ? "PATCH" : "POST",
        body: {
          name: form.name,
          amountLimit: amountResult.value,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          cadence: form.cadence,
          alertThresholdPercent: Number(form.alertThresholdPercent),
          ...(form.categoryId ? { categoryId: form.categoryId } : {}),
          ...(form.subcategoryId ? { subcategoryId: form.subcategoryId } : {}),
          ...(form.notes ? { notes: form.notes } : {})
        }
      })
        .then(async () => {
          await budgets.reload();
          notifyDataChanged();
          const message = editingId ? "Orcamento atualizado." : "Orcamento criado.";
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
    if (!window.confirm("Arquivar este orcamento?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/budgets/${id}`, { method: "DELETE" })
        .then(async () => {
          await budgets.reload();
          notifyDataChanged();
          if (editingId === id) {
            resetForm();
          }
          showToast({ tone: "success", message: "Orcamento arquivado." });
        })
        .catch((submitError) => {
          showToast({ tone: "error", message: readApiError(submitError) });
        });
    });
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !budgets.data || !categories.data) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Orcamentos indisponiveis"
          description={error ?? "Nao foi possivel carregar seus limites do mes."}
        />
      </div>
    );
  }

  if (budgets.data.items.length === 0 && !editingId) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Orcamentos"
          title="Nenhum limite configurado"
          description="Defina seus principais tetos mensais para transformar gasto em decisao."
        />
        <div className="two-column">
          <SectionCard title="Novo orcamento" subtitle="Comece por moradia, mercado ou delivery">
            <form className="editor-form" onSubmit={handleSubmit}>
              <InputField label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <InputField label="Limite" type="number" min="0" step="0.01" value={form.amountLimit} onChange={(event) => setForm((current) => ({ ...current, amountLimit: event.target.value }))} required />
              <FormActions submitLabel="Criar orcamento" pending={isPending} />
              {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}
            </form>
          </SectionCard>
          <EmptyModuleState
            title="Sem radar de limites ainda"
            description="Cadastre um orcamento para comparar planejado, realizado e previsao."
            cta="Criar primeiro orcamento"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Orcamentos"
        title="Limites simples para manter o mes sob controle"
        description="Veja o planejado, o realizado e o risco de estouro sem excesso de informacao."
      />

      <section className="stats-grid compact">
        <StatCard label="Planejado" value={formatCurrency(budgets.data.totals.planned)} helper="Soma dos limites ativos" />
        <StatCard label="Realizado" value={formatCurrency(budgets.data.totals.actual)} helper="Ja consumido no periodo" tone="positive" />
        <StatCard label="Previsao" value={formatCurrency(budgets.data.totals.forecast)} helper="Fechamento esperado" tone="warning" />
        <StatCard label="Em risco" value={String(budgets.data.atRisk.length)} helper="Itens acima do plano" tone={budgets.data.atRisk.length > 0 ? "critical" : "positive"} />
      </section>

      <div className="two-column">
        <SectionCard title={editingId ? "Editar orcamento" : "Novo orcamento"} subtitle="Cadastro claro e direto">
          <form className="editor-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <InputField label="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <InputField label="Limite" type="number" min="0" step="0.01" value={form.amountLimit} onChange={(event) => setForm((current) => ({ ...current, amountLimit: event.target.value }))} required />
              <InputField label="Inicio" type="date" value={form.periodStart} onChange={(event) => setForm((current) => ({ ...current, periodStart: event.target.value }))} required />
              <InputField label="Fim" type="date" value={form.periodEnd} onChange={(event) => setForm((current) => ({ ...current, periodEnd: event.target.value }))} required />
              <SelectField
                label="Cadencia"
                value={form.cadence}
                onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value }))}
                options={budgetCadenceOptions.map((option) => ({ value: option, label: humanizeEnum(option) }))}
              />
              <InputField label="Alerta em %" type="number" min="1" max="100" value={form.alertThresholdPercent} onChange={(event) => setForm((current) => ({ ...current, alertThresholdPercent: event.target.value }))} />
              <SelectField
                label="Categoria"
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value, subcategoryId: "" }))}
                options={categories.data.items.map((category) => ({ value: category.id, label: category.name }))}
              />
              <SelectField
                label="Subcategoria"
                value={form.subcategoryId}
                onChange={(event) => setForm((current) => ({ ...current, subcategoryId: event.target.value }))}
                options={(selectedCategory?.subcategories ?? []).map((subcategory) => ({ value: subcategory.id, label: subcategory.name }))}
              />
            </div>

            <TextAreaField label="Notas" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

            {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

            <FormActions
              submitLabel={editingId ? "Salvar alteracoes" : "Criar orcamento"}
              cancelLabel={editingId ? "Cancelar edicao" : undefined}
              onCancel={editingId ? resetForm : undefined}
              pending={isPending}
            />
          </form>
        </SectionCard>

        <SectionCard title="Seus limites" subtitle="Leitura rapida do que precisa de atencao">
          <div className="stack-list">
            {budgets.data.items.map((budget) => {
              const actualPercent = budget.planned > 0 ? (budget.actual / budget.planned) * 100 : 0;
              const forecastPercent = budget.planned > 0 ? (budget.forecast / budget.planned) * 100 : 0;

              return (
                <article key={budget.id} className="budget-card">
                  <div className="stack-head">
                    <strong>{budget.category}</strong>
                    <span>{budget.cadence}</span>
                  </div>
                  <p>{formatCurrency(budget.planned)} no periodo</p>
                  <ProgressBar value={actualPercent} tone={actualPercent > 100 ? "critical" : "positive"} label={`Atual ${formatCurrency(budget.actual)}`} />
                  <ProgressBar value={forecastPercent} tone={forecastPercent > 100 ? "warning" : "default"} label={`Previsao ${formatCurrency(budget.forecast)}`} />
                  <div className="list-actions">
                    <button type="button" className="ghost-button" onClick={() => loadBudgetIntoForm(budget)}>
                      Editar
                    </button>
                    <button type="button" className="danger-button" onClick={() => handleArchive(budget.id)}>
                      Arquivar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
