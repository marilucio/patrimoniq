"use client";

import Link from "next/link";
import { formatCurrency } from "@patrimoniq/domain";
import { useState, useTransition } from "react";
import { EmptyModuleState, ErrorState, LoadingState } from "../../components/page-state";
import {
  CurrencyField,
  FeedbackBanner,
  FormActions,
  InputField,
  SelectField,
  TextAreaField
} from "../../components/form-controls";
import { useToast } from "../../components/toast-provider";
import { DataTable, PageIntro, SectionCard, StatCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import {
  apiRequest,
  readApiError,
  type AccountsResponse,
  type CategoriesResponse,
  type TransactionsResponse
} from "../../lib/api";
import { notifyDataChanged } from "../../lib/live-data";
import {
  costNatureOptions,
  essentialityOptions,
  humanizeEnum,
  paymentMethodOptions,
  transactionStatusOptions,
  transactionTypeOptions
} from "../../lib/options";
import {
  parsePositiveAmount,
  toCurrencyInputValue,
  validateIsoDate
} from "../../lib/validation";

const pageSize = 12;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildTransactionsPath(filters: {
  page: number;
  search: string;
  status: string;
  direction: string;
  categoryId: string;
  subcategoryId: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }

  if (filters.direction && filters.direction !== "ALL") {
    params.set("direction", filters.direction);
  }

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.subcategoryId) {
    params.set("subcategoryId", filters.subcategoryId);
  }

  return `/transactions?${params.toString()}`;
}

const emptyTransactionForm = {
  description: "",
  amount: "",
  postedAt: today(),
  type: "EXPENSE",
  status: "CLEARED",
  accountId: "",
  categoryId: "",
  subcategoryId: "",
  paymentMethod: "PIX",
  costNature: "VARIABLE",
  essentiality: "IMPORTANT",
  notes: ""
};

const emptyFilters = {
  page: 1,
  search: "",
  status: "ALL",
  direction: "ALL",
  categoryId: "",
  subcategoryId: ""
};

export function TransactionsClientPage() {
  const [form, setForm] = useState(emptyTransactionForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const transactions = useApiResource<TransactionsResponse>(buildTransactionsPath(filters));
  const accounts = useApiResource<AccountsResponse>("/accounts");
  const categories = useApiResource<CategoriesResponse>("/categories");

  const loading = transactions.loading || accounts.loading || categories.loading;
  const error = transactions.error ?? accounts.error ?? categories.error;
  const selectedCategory = categories.data?.items.find((item) => item.id === form.categoryId);
  const selectedFilterCategory = categories.data?.items.find(
    (item) => item.id === filters.categoryId
  );
  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.status !== "ALL" ||
    filters.direction !== "ALL" ||
    Boolean(filters.categoryId) ||
    Boolean(filters.subcategoryId);

  function resetForm() {
    setForm(emptyTransactionForm);
    setEditingId(null);
    setFeedback(null);
  }

  function resetFilters() {
    setFilters(emptyFilters);
  }

  function patchFilters(
    patch: Partial<typeof emptyFilters>,
    options?: {
      preservePage?: boolean;
    }
  ) {
    setFilters((current) => ({
      ...current,
      ...patch,
      page:
        options?.preservePage || Object.prototype.hasOwnProperty.call(patch, "page")
          ? patch.page ?? current.page
          : 1
    }));
  }

  function loadTransactionIntoForm(item: TransactionsResponse["items"][number]) {
    setEditingId(item.id);
    setForm({
      description: item.description,
      amount: toCurrencyInputValue(item.amount),
      postedAt: item.date,
      type: item.typeCode,
      status: item.statusCode,
      accountId: item.accountId ?? "",
      categoryId: item.categoryId ?? "",
      subcategoryId: item.subcategoryId ?? "",
      paymentMethod: item.paymentMethodCode ?? "OTHER",
      costNature: item.natureCode ?? "VARIABLE",
      essentiality: item.essentialityCode ?? "IMPORTANT",
      notes: item.notes ?? ""
    });
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const amountResult = parsePositiveAmount(form.amount, "Valor");
    if (amountResult.error) {
      setFeedback({ tone: "error", message: amountResult.error });
      showToast({ tone: "error", message: amountResult.error });
      return;
    }

    const dateError = validateIsoDate(form.postedAt, "Data");
    if (dateError) {
      setFeedback({ tone: "error", message: dateError });
      showToast({ tone: "error", message: dateError });
      return;
    }

    startTransition(() => {
      void apiRequest(editingId ? `/transactions/${editingId}` : "/transactions", {
        method: editingId ? "PATCH" : "POST",
        body: {
          description: form.description,
          amount: amountResult.value,
          postedAt: form.postedAt,
          type: form.type,
          status: form.status,
          paymentMethod: form.paymentMethod,
          costNature: form.costNature,
          essentiality: form.essentiality,
          ...(form.accountId ? { accountId: form.accountId } : {}),
          ...(form.categoryId ? { categoryId: form.categoryId } : {}),
          ...(form.subcategoryId ? { subcategoryId: form.subcategoryId } : {}),
          ...(form.notes ? { notes: form.notes } : {})
        }
      })
        .then(async () => {
          await transactions.reload();
          notifyDataChanged();
          const message = editingId ? "Transacao atualizada." : "Transacao criada.";
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
    if (!window.confirm("Cancelar esta transacao?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/transactions/${id}`, { method: "DELETE" })
        .then(async () => {
          await transactions.reload();
          notifyDataChanged();
          if (editingId === id) {
            resetForm();
          }
          showToast({ tone: "success", message: "Transacao cancelada." });
        })
        .catch((submitError) => {
          showToast({ tone: "error", message: readApiError(submitError) });
        });
    });
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !transactions.data || !accounts.data || !categories.data) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Transacoes indisponiveis"
          description={error ?? "Nao foi possivel carregar suas transacoes."}
        />
      </div>
    );
  }

  if (transactions.data.pagination.totalItems === 0 && !editingId && !hasActiveFilters) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Transacoes"
          title="Nenhuma transacao registrada"
          description="Registre receitas e despesas para visualizar seu mes."
        />
        <div className="two-column">
          <SectionCard title="Nova transacao" subtitle="Registre sua primeira movimentacao">
            {accounts.data.items.length === 0 ? (
              <FeedbackBanner
                tone="info"
                message="Cadastre uma conta em Configuracoes antes de registrar movimentacoes."
              />
            ) : null}
            <form className="editor-form" onSubmit={handleSubmit}>
              <InputField
                label="Descricao"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                required
              />
              <CurrencyField
                label="Valor"
                value={form.amount}
                onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))}
                required
              />
              <FormActions submitLabel="Criar transacao" pending={isPending} />
              {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}
            </form>
            {accounts.data.items.length === 0 ? (
              <Link href="/settings" className="inline-link">
                Abrir configuracoes
              </Link>
            ) : null}
          </SectionCard>
          <EmptyModuleState
            title="Sem movimentacoes ainda"
            description="Registre receitas e despesas para ativar os filtros e o resumo do mes."
            cta="Comecar agora"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Transacoes"
        title="Seu fluxo financeiro"
        description="Lance, filtre e ajuste suas movimentacoes."
        actions={<div className="hero-chip">{transactions.data.pagination.totalItems} registros</div>}
      />

      <section className="stats-grid compact">
        <StatCard
          label="Receitas"
          value={formatCurrency(transactions.data.summary.income)}
          helper="Compensadas no mes"
          tone="positive"
        />
        <StatCard
          label="Despesas"
          value={formatCurrency(transactions.data.summary.expenses)}
          helper="Compensadas no mes"
        />
        <StatCard
          label="A vencer"
          value={formatCurrency(transactions.data.summary.planned)}
          helper="Planejadas ou pendentes"
          tone="warning"
        />
        <StatCard
          label="Pagina"
          value={`${transactions.data.pagination.page}/${transactions.data.pagination.totalPages}`}
          helper="Listagem paginada"
        />
      </section>

      <SectionCard
        title="Filtros rapidos"
        subtitle="Refine a lista por periodo, categoria ou status"
        className="subtle-card"
      >
        <div className="filter-shell">
          <InputField
            label="Buscar lancamento"
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
            placeholder="Ex.: mercado, aluguel, pix"
            hint="Busque por descricao."
          />
          <SelectField
            label="Direcao"
            value={filters.direction}
            onChange={(event) => patchFilters({ direction: event.target.value })}
            options={[
              { value: "ALL", label: "Todas" },
              { value: "income", label: "Receitas" },
              { value: "expense", label: "Despesas" },
              { value: "transfer", label: "Transferencias" }
            ]}
          />
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => patchFilters({ status: event.target.value })}
            options={[
              { value: "ALL", label: "Todos" },
              ...transactionStatusOptions.map((option) => ({
                value: option,
                label: humanizeEnum(option)
              }))
            ]}
          />
          <SelectField
            label="Categoria"
            value={filters.categoryId}
            onChange={(event) =>
              patchFilters({
                categoryId: event.target.value,
                subcategoryId: ""
              })
            }
            options={categories.data.items.map((category) => ({
              value: category.id,
              label: category.name
            }))}
          />
          <SelectField
            label="Subcategoria"
            value={filters.subcategoryId}
            onChange={(event) => patchFilters({ subcategoryId: event.target.value })}
            options={(selectedFilterCategory?.subcategories ?? []).map((subcategory) => ({
              value: subcategory.id,
              label: subcategory.name
            }))}
          />
        </div>
        <div className="filter-summary">
          <span>
            {hasActiveFilters
              ? "Filtros ativos. A lista mostra apenas os resultados correspondentes."
              : "Sem filtros. Mostrando todas as movimentacoes do periodo."}
          </span>
          <button type="button" className="ghost-button" onClick={resetFilters}>
            Limpar filtros
          </button>
        </div>
      </SectionCard>

      <div className="transaction-layout">
        <SectionCard
          title={editingId ? "Editar transacao" : "Nova transacao"}
          subtitle="Preencha os campos para registrar a movimentacao"
          className="editor-card"
          actions={
            editingId ? <span className="pill">Editando lancamento</span> : null
          }
        >
          {accounts.data.items.length === 0 ? (
            <FeedbackBanner
              tone="info"
              message="Cadastre uma conta em Configuracoes antes de registrar movimentacoes."
            />
          ) : null}
          <form className="editor-form" onSubmit={handleSubmit}>
            <div className="form-panel-grid">
              <section className="form-panel">
                <div className="form-panel-header">
                  <strong>Essencial</strong>
                  <p>Dados principais da movimentacao.</p>
                </div>
                <div className="form-grid">
                  <InputField
                    label="Descricao"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    required
                  />
                  <CurrencyField
                    label="Valor"
                    value={form.amount}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, amount: value }))
                    }
                    required
                  />
                  <InputField
                    label="Data"
                    type="date"
                    value={form.postedAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, postedAt: event.target.value }))
                    }
                    required
                  />
                  <SelectField
                    label="Tipo"
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value }))
                    }
                    options={transactionTypeOptions.map((option) => ({
                      value: option,
                      label: humanizeEnum(option)
                    }))}
                  />
                </div>
              </section>

              <section className="form-panel">
                <div className="form-panel-header">
                  <strong>Classificacao</strong>
                  <p>Como este lancamento aparece nos relatorios.</p>
                </div>
                <div className="form-grid">
                  <SelectField
                    label="Categoria"
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                        subcategoryId: ""
                      }))
                    }
                    options={categories.data.items.map((category) => ({
                      value: category.id,
                      label: category.name
                    }))}
                  />
                  <SelectField
                    label="Subcategoria"
                    value={form.subcategoryId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subcategoryId: event.target.value }))
                    }
                    options={(selectedCategory?.subcategories ?? []).map((subcategory) => ({
                      value: subcategory.id,
                      label: subcategory.name
                    }))}
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, status: event.target.value }))
                    }
                    options={transactionStatusOptions.map((option) => ({
                      value: option,
                      label: humanizeEnum(option)
                    }))}
                  />
                  <SelectField
                    label="Essencialidade"
                    value={form.essentiality}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, essentiality: event.target.value }))
                    }
                    options={essentialityOptions.map((option) => ({
                      value: option,
                      label: humanizeEnum(option)
                    }))}
                  />
                  <SelectField
                    label="Natureza"
                    value={form.costNature}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, costNature: event.target.value }))
                    }
                    options={costNatureOptions.map((option) => ({
                      value: option,
                      label: humanizeEnum(option)
                    }))}
                  />
                </div>
              </section>

              <section className="form-panel">
                <div className="form-panel-header">
                  <strong>Conta e observacoes</strong>
                  <p>Conta utilizada e informacoes adicionais.</p>
                </div>
                <div className="form-grid">
                  <SelectField
                    label="Conta"
                    value={form.accountId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, accountId: event.target.value }))
                    }
                    options={accounts.data.items.map((account) => ({
                      value: account.id,
                      label: account.name
                    }))}
                  />
                  <SelectField
                    label="Forma de pagamento"
                    value={form.paymentMethod}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentMethod: event.target.value }))
                    }
                    options={paymentMethodOptions.map((option) => ({
                      value: option,
                      label: humanizeEnum(option)
                    }))}
                  />
                </div>
                <TextAreaField
                  label="Notas"
                  rows={3}
                  hint="Opcional. Use para lembrar contexto, prazo ou decisao."
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </section>
            </div>

            {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

            <FormActions
              submitLabel={editingId ? "Salvar alteracoes" : "Criar transacao"}
              cancelLabel={editingId ? "Cancelar edicao" : undefined}
              onCancel={editingId ? resetForm : undefined}
              pending={isPending}
            />
          </form>
        </SectionCard>

        <SectionCard
          title="Lancamentos"
          subtitle="Revise e gerencie suas movimentacoes"
          className="ledger-card"
          actions={
            <span className="pill">
              Pagina {transactions.data.pagination.page} de {transactions.data.pagination.totalPages}
            </span>
          }
        >
          {transactions.data.items.length > 0 ? (
            <>
              <DataTable
                columns={["Data", "Lancamento", "Classificacao", "Situacao", "Valor", "Acoes"]}
                rows={transactions.data.items.map((item) => [
                  item.date,
                  <>
                    <strong>{item.description}</strong>
                    <div className="table-sub">{item.account}</div>
                  </>,
                  <>
                    <strong>{item.category}</strong>
                    <div className="table-sub">
                      {item.subcategory} · {item.type}
                    </div>
                  </>,
                  <>
                    <span className={`status-pill ${item.statusTone}`}>{item.status}</span>
                    <div className="table-sub">{item.paymentMethod}</div>
                  </>,
                  <div className="value-stack">
                    <strong>{formatCurrency(item.amount)}</strong>
                    <span className="table-sub">{item.essentiality}</span>
                  </div>,
                  <div key={`${item.id}-actions`} className="list-actions compact-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => loadTransactionIntoForm(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleArchive(item.id)}
                    >
                      Cancelar
                    </button>
                  </div>
                ])}
              />
              <div className="pagination-bar">
                <p>Mostrando {transactions.data.items.length} lancamentos nesta pagina.</p>
                <div className="list-actions compact-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={transactions.data.pagination.page <= 1}
                    onClick={() => patchFilters({ page: filters.page - 1 }, { preservePage: true })}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={
                      transactions.data.pagination.page >= transactions.data.pagination.totalPages
                    }
                    onClick={() => patchFilters({ page: filters.page + 1 }, { preservePage: true })}
                  >
                    Proxima
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyModuleState
              title="Nenhum resultado encontrado"
              description="Ajuste os filtros para voltar a ver seus lancamentos."
              cta="Limpar filtros"
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
