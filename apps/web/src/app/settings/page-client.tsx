"use client";

import { formatCurrency } from "@patrimoniq/domain";
import { useState, useTransition } from "react";
import { ErrorState, LoadingState } from "../../components/page-state";
import {
  FeedbackBanner,
  FormActions,
  InputField,
  SelectField,
  TextAreaField
} from "../../components/form-controls";
import { EmptyState, PageIntro, SectionCard } from "../../components/ui";
import { useToast } from "../../components/toast-provider";
import { useApiResource } from "../../hooks/use-api-resource";
import {
  type AnalyticsSummaryResponse,
  apiRequest,
  readApiError,
  type AccountsResponse,
  type CategoriesResponse,
  type FeedbackResponse,
  type SettingsResponse,
  type SubcategoriesResponse
} from "../../lib/api";
import { featureFlags } from "../../lib/feature-flags";
import { notifyDataChanged } from "../../lib/live-data";
import {
  accountTypeOptions,
  categoryDirectionOptions,
  costNatureOptions,
  essentialityOptions,
  humanizeEnum,
  slugify
} from "../../lib/options";

const emptyAccountForm = {
  name: "",
  type: "CHECKING",
  institutionName: "",
  openingBalance: ""
};

const emptyCategoryForm = {
  name: "",
  slug: "",
  direction: "EXPENSE",
  subcategoriesText: ""
};

const emptySubcategoryForm = {
  categoryId: "",
  name: "",
  slug: "",
  costNature: "",
  essentiality: ""
};

export function SettingsClientPage() {
  const settings = useApiResource<SettingsResponse>("/settings");
  const accounts = useApiResource<AccountsResponse>("/accounts");
  const categories = useApiResource<CategoriesResponse>("/categories");
  const subcategories = useApiResource<SubcategoriesResponse>("/subcategories");
  const analytics = useApiResource<AnalyticsSummaryResponse>("/analytics/summary");
  const feedbackItems = useApiResource<FeedbackResponse>("/feedback?limit=5");
  const { showToast } = useToast();
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategoryForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const loading =
    settings.loading ||
    accounts.loading ||
    categories.loading ||
    subcategories.loading ||
    analytics.loading ||
    feedbackItems.loading;
  const error =
    settings.error ??
    accounts.error ??
    categories.error ??
    subcategories.error ??
    analytics.error ??
    feedbackItems.error;
  const runtime = settings.data?.runtime;
  const analyticsMap = new Map(
    (analytics.data?.events ?? []).map((item) => [item.name, item])
  );

  async function refreshAll() {
    await Promise.all([
      settings.reload(),
      accounts.reload(),
      categories.reload(),
      subcategories.reload(),
      analytics.reload(),
      feedbackItems.reload()
    ]);
    notifyDataChanged();
  }

  function resetAccountForm() {
    setAccountForm(emptyAccountForm);
    setEditingAccountId(null);
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryId(null);
  }

  function resetSubcategoryForm() {
    setSubcategoryForm(emptySubcategoryForm);
    setEditingSubcategoryId(null);
  }

  function loadAccount(item: AccountsResponse["items"][number]) {
    setEditingAccountId(item.id);
    setAccountForm({
      name: item.name,
      type: item.typeCode,
      institutionName: item.institutionName ?? "",
      openingBalance: String(item.openingBalance)
    });
    setFeedback(null);
  }

  function loadCategory(item: CategoriesResponse["items"][number]) {
    setEditingCategoryId(item.id);
    setCategoryForm({
      name: item.name,
      slug: item.slug,
      direction: item.directionCode,
      subcategoriesText: item.subcategories.map((subcategory) => subcategory.name).join("\n")
    });
    setFeedback(null);
  }

  function loadSubcategory(item: SubcategoriesResponse["items"][number]) {
    setEditingSubcategoryId(item.id);
    setSubcategoryForm({
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      costNature: item.costNature ?? "",
      essentiality: item.essentiality ?? ""
    });
    setFeedback(null);
  }

  function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void apiRequest(editingAccountId ? `/accounts/${editingAccountId}` : "/accounts", {
        method: editingAccountId ? "PATCH" : "POST",
        body: {
          name: accountForm.name,
          type: accountForm.type,
          ...(accountForm.institutionName
            ? { institutionName: accountForm.institutionName }
            : {}),
          ...(accountForm.openingBalance
            ? { openingBalance: Number(accountForm.openingBalance) }
            : {})
        }
      })
        .then(async () => {
          await refreshAll();
          showToast({
            tone: "success",
            message: editingAccountId ? "Conta atualizada." : "Conta criada."
          });
          resetAccountForm();
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nestedSubcategories = categoryForm.subcategoriesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        slug: slugify(name)
      }));

    startTransition(() => {
      void apiRequest(editingCategoryId ? `/categories/${editingCategoryId}` : "/categories", {
        method: editingCategoryId ? "PATCH" : "POST",
        body: {
          name: categoryForm.name,
          slug: categoryForm.slug || slugify(categoryForm.name),
          direction: categoryForm.direction,
          ...(!editingCategoryId && nestedSubcategories.length > 0
            ? { subcategories: nestedSubcategories }
            : {})
        }
      })
        .then(async () => {
          await refreshAll();
          showToast({
            tone: "success",
            message: editingCategoryId ? "Categoria atualizada." : "Categoria criada."
          });
          resetCategoryForm();
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function submitSubcategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void apiRequest(
        editingSubcategoryId ? `/subcategories/${editingSubcategoryId}` : "/subcategories",
        {
          method: editingSubcategoryId ? "PATCH" : "POST",
          body: {
            categoryId: subcategoryForm.categoryId,
            name: subcategoryForm.name,
            slug: subcategoryForm.slug || slugify(subcategoryForm.name),
            ...(subcategoryForm.costNature ? { costNature: subcategoryForm.costNature } : {}),
            ...(subcategoryForm.essentiality
              ? { essentiality: subcategoryForm.essentiality }
              : {})
          }
        }
      )
        .then(async () => {
          await refreshAll();
          showToast({
            tone: "success",
            message: editingSubcategoryId
              ? "Subcategoria atualizada."
              : "Subcategoria criada."
          });
          resetSubcategoryForm();
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function archiveAccount(id: string) {
    if (!window.confirm("Arquivar esta conta?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/accounts/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingAccountId === id) {
            resetAccountForm();
          }
          showToast({ tone: "success", message: "Conta arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  function archiveCategory(id: string) {
    if (!window.confirm("Arquivar esta categoria e suas subcategorias?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/categories/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingCategoryId === id) {
            resetCategoryForm();
          }
          showToast({ tone: "success", message: "Categoria arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  function archiveSubcategory(id: string) {
    if (!window.confirm("Arquivar esta subcategoria?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/subcategories/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingSubcategoryId === id) {
            resetSubcategoryForm();
          }
          showToast({ tone: "success", message: "Subcategoria arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  function sendEmailTest() {
    startTransition(() => {
      void apiRequest<{ success: true; message: string }>("/settings/diagnostics/email-test", {
        method: "POST"
      })
        .then((result) => {
          setFeedback({ tone: "success", message: result.message });
          showToast({ tone: "success", message: result.message });
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  if (loading) {
    return <LoadingState />;
  }

  if (
    error ||
    !settings.data ||
    !accounts.data ||
    !categories.data ||
    !subcategories.data ||
    !analytics.data ||
    !feedbackItems.data
  ) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Configuracoes indisponiveis"
          description={error ?? "Nao foi possivel carregar as configuracoes da sua conta."}
        />
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Configuracoes"
        title="Base da sua conta pessoal"
        description="Ajuste contas, categorias e subcategorias para deixar o uso diario rapido, limpo e consistente."
        actions={<div className="hero-chip">Conta individual</div>}
      />

      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      <div className="two-column">
        <SectionCard title="Perfil da conta" subtitle="Quem esta usando e como a base foi preparada">
          <div className="profile-grid">
            <div className="profile-row">
              <span>Nome</span>
              <strong>{settings.data.profile.fullName}</strong>
            </div>
            <div className="profile-row">
              <span>E-mail</span>
              <strong>{settings.data.profile.email}</strong>
            </div>
            <div className="profile-row">
              <span>Idioma</span>
              <strong>{settings.data.profile.locale}</strong>
            </div>
            <div className="profile-row">
              <span>Contas cadastradas</span>
              <strong>{accounts.data.items.length}</strong>
            </div>
            <div className="profile-row">
              <span>Categorias ativas</span>
              <strong>{categories.data.items.length}</strong>
            </div>
            <div className="profile-row">
              <span>Subcategorias ativas</span>
              <strong>{subcategories.data.items.length}</strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Ambiente beta"
          subtitle="O que ja esta pronto para uso real e o que ainda merece atencao"
          actions={
            runtime?.email.canSendTestEmail ? (
              <button type="button" className="ghost-button" onClick={sendEmailTest} disabled={isPending}>
                {isPending ? "Testando..." : "Enviar teste para meu e-mail"}
              </button>
            ) : null
          }
        >
          {runtime ? (
            <div className="stack-list">
              <div className="stack-row">
                <div className="stack-head">
                  <strong>Envio transacional</strong>
                  <span>{runtime.email.canSendRealEmail ? "SMTP real ativo" : "Modo de desenvolvimento"}</span>
                </div>
                <p>
                  Canal ativo: {runtime.email.resolvedProvider}. Remetente: {runtime.email.fromAddress}.
                </p>
              </div>
              <div className="stack-row">
                <div className="stack-head">
                  <strong>Sessao e cookies</strong>
                  <span>{runtime.session.cookieSecure ? "Seguro" : "Modo local"}</span>
                </div>
                <p>
                  SameSite {runtime.session.sameSite} · dominio{" "}
                  {runtime.session.cookieDomain ?? "host atual"} · proxy {runtime.session.proxyMode}.
                </p>
              </div>
              <div className="stack-row">
                <div className="stack-head">
                  <strong>Monitoramento</strong>
                  <span>{runtime.monitoring.enabled ? "Externo ativo" : "Logs locais"}</span>
                </div>
                <p>{runtime.monitoring.targetLabel}.</p>
              </div>
              <div className="stack-row">
                <div className="stack-head">
                  <strong>Canal de feedback beta</strong>
                  <span>{runtime.feedback.relayMode}</span>
                </div>
                <p>{runtime.feedback.targetLabel}.</p>
              </div>
              {runtime.warnings.length > 0 ? (
                <div className="soft-empty warning-soft">
                  <strong>Pontos antes de abrir o beta</strong>
                  <div className="warning-list">
                    {runtime.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="soft-empty">
                  <strong>Base operacional pronta.</strong>
                  <p>Dominio, sessao e canais essenciais ja estao coerentes para um beta controlado.</p>
                </div>
              )}
              <div className="soft-empty">
                <strong>Teste de e-mail</strong>
                <p>
                  Use o botao acima para validar entrega. Se necessario, confira spam e lixo
                  eletronico. Quando `SMTP_VERIFY_CONNECTION=true`, a API valida a conexao no boot.
                </p>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard
          title="Sinais do beta"
          subtitle="Eventos basicos para acompanhar ativacao e uso inicial"
        >
          <div className="stack-list">
            {[
              "REGISTER_COMPLETED",
              "LOGIN_COMPLETED",
              "DASHBOARD_FIRST_VIEWED",
              "FIRST_ACCOUNT_CREATED",
              "FIRST_INCOME_CREATED",
              "FIRST_EXPENSE_CREATED",
              "FIRST_GOAL_CREATED",
              "PASSWORD_RESET_REQUESTED",
              "FEEDBACK_SUBMITTED"
            ].map((eventName) => {
              const item = analyticsMap.get(eventName);

              return (
                <div key={eventName} className="stack-row">
                  <div className="stack-head">
                    <strong>{item?.label ?? eventName}</strong>
                    <span>{item?.count ?? 0}</span>
                  </div>
                  <p>
                    {item?.lastOccurredAt
                      ? `Ultimo registro em ${new Date(item.lastOccurredAt).toLocaleString("pt-BR")}.`
                      : "Ainda nao ocorreu nesta conta."}
                  </p>
                </div>
              );
            })}
          </div>

          {analytics.data.onboarding.isStalled ? (
            <div className="soft-empty warning-soft">
              <strong>Onboarding com atrito detectado</strong>
              <p>
                Etapas pendentes: {analytics.data.onboarding.remainingSteps.join(", ") || "sem detalhe"}.
              </p>
            </div>
          ) : (
            <div className="soft-empty">
              <strong>Onboarding sem sinal de abandono.</strong>
              <p>Enquanto os passos avancam cedo, a base fica mais preparada para o beta pequeno.</p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Feedback recente"
          subtitle="Os ultimos relatos enviados por esta conta beta"
        >
          {feedbackItems.data.items.length > 0 ? (
            <div className="stack-list">
              {feedbackItems.data.items.map((item) => (
                <div key={item.id} className="stack-row">
                  <div className="stack-head">
                    <strong>{item.category}</strong>
                    <span>{item.status}</span>
                  </div>
                  <p>{item.message}</p>
                  <div className="tag-list">
                    {item.pagePath ? <span className="tag-chip">{item.pagePath}</span> : null}
                    <span className="tag-chip">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum feedback enviado ainda"
              description="Use o botao discreto no canto da tela para relatar friccao, bug ou sugestao."
              cta="Coleta de feedback ativa"
            />
          )}
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="Integracoes e roadmap" subtitle="O que ja esta pronto e o que ainda fica protegido">
          <div className="stack-list">
            {settings.data.integrations.map((integration) => (
              <div key={integration} className="stack-row">
                <div className="stack-head">
                  <strong>{integration}</strong>
                  <span>
                    {featureFlags.imports || featureFlags.openFinance ? "Preparado" : "Em breve"}
                  </span>
                </div>
                <p>Fluxo isolado por feature flag para manter o app simples nesta fase.</p>
              </div>
            ))}
          </div>
          <div className="soft-empty">
            <strong>Base fiscal em preparacao.</strong>
            <p>
              {settings.data.fiscalReadiness.deductibleGroups.length} grupos dedutiveis mapeados.
              Modo de exportacao: {settings.data.fiscalReadiness.exportMode}.
            </p>
          </div>
        </SectionCard>

        <SectionCard title={editingAccountId ? "Editar conta" : "Nova conta"} subtitle="Contas e saldos iniciais">
          <form className="editor-form" onSubmit={submitAccount}>
            <div className="form-grid">
              <InputField
                label="Nome"
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
              <SelectField
                label="Tipo"
                value={accountForm.type}
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, type: event.target.value }))
                }
                options={accountTypeOptions.map((option) => ({
                  value: option,
                  label: humanizeEnum(option)
                }))}
              />
              <InputField
                label="Instituicao"
                value={accountForm.institutionName}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    institutionName: event.target.value
                  }))
                }
              />
              <InputField
                label="Saldo inicial"
                type="number"
                min="0"
                step="0.01"
                value={accountForm.openingBalance}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    openingBalance: event.target.value
                  }))
                }
              />
            </div>
            <FormActions
              submitLabel={editingAccountId ? "Salvar conta" : "Criar conta"}
              cancelLabel={editingAccountId ? "Cancelar" : undefined}
              onCancel={editingAccountId ? resetAccountForm : undefined}
              pending={isPending}
            />
          </form>

          <div className="stack-list">
            {accounts.data.items.map((account) => (
              <div key={account.id} className="stack-row">
                <div className="stack-head">
                  <strong>{account.name}</strong>
                  <span>{account.type}</span>
                </div>
                <p>
                  Saldo inicial {formatCurrency(account.openingBalance)} · saldo atual{" "}
                  {formatCurrency(account.currentBalance)}
                </p>
                <div className="list-actions">
                  <button type="button" className="ghost-button" onClick={() => loadAccount(account)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => archiveAccount(account.id)}
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={editingCategoryId ? "Editar categoria" : "Nova categoria"} subtitle="Organize seu mapa financeiro">
          <form className="editor-form" onSubmit={submitCategory}>
            <div className="form-grid">
              <InputField
                label="Nome"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: slugify(event.target.value)
                  }))
                }
                required
              />
              <InputField
                label="Slug"
                value={categoryForm.slug}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, slug: event.target.value }))
                }
                required
              />
              <SelectField
                label="Direcao"
                value={categoryForm.direction}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, direction: event.target.value }))
                }
                options={categoryDirectionOptions.map((option) => ({
                  value: option,
                  label: humanizeEnum(option)
                }))}
              />
            </div>

            <TextAreaField
              label="Subcategorias iniciais"
              rows={5}
              value={categoryForm.subcategoriesText}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  subcategoriesText: event.target.value
                }))
              }
              hint={
                editingCategoryId
                  ? "Na edicao, a categoria principal e atualizada. As subcategorias sao geridas abaixo."
                  : "Uma subcategoria por linha."
              }
            />

            <FormActions
              submitLabel={editingCategoryId ? "Salvar categoria" : "Criar categoria"}
              cancelLabel={editingCategoryId ? "Cancelar" : undefined}
              onCancel={editingCategoryId ? resetCategoryForm : undefined}
              pending={isPending}
            />
          </form>

          <div className="stack-list">
            {categories.data.items.map((category) => (
              <div key={category.id} className="stack-row">
                <div className="stack-head">
                  <strong>{category.name}</strong>
                  <span>{category.direction}</span>
                </div>
                <p>{category.subcategories.length} subcategorias ativas.</p>
                <div className="tag-list">
                  {category.subcategories.slice(0, 6).map((subcategory) => (
                    <span key={subcategory.id} className="tag-chip">
                      {subcategory.name}
                    </span>
                  ))}
                </div>
                <div className="list-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => loadCategory(category)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => archiveCategory(category.id)}
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title={editingSubcategoryId ? "Editar subcategoria" : "Nova subcategoria"} subtitle="Detalhe fino para transacoes e orcamentos">
          <form className="editor-form" onSubmit={submitSubcategory}>
            <div className="form-grid">
              <SelectField
                label="Categoria"
                value={subcategoryForm.categoryId}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    categoryId: event.target.value
                  }))
                }
                options={categories.data.items.map((category) => ({
                  value: category.id,
                  label: category.name
                }))}
              />
              <InputField
                label="Nome"
                value={subcategoryForm.name}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: slugify(event.target.value)
                  }))
                }
                required
              />
              <InputField
                label="Slug"
                value={subcategoryForm.slug}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({ ...current, slug: event.target.value }))
                }
                required
              />
              <SelectField
                label="Natureza"
                value={subcategoryForm.costNature}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    costNature: event.target.value
                  }))
                }
                options={costNatureOptions.map((option) => ({
                  value: option,
                  label: humanizeEnum(option)
                }))}
              />
              <SelectField
                label="Essencialidade"
                value={subcategoryForm.essentiality}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    essentiality: event.target.value
                  }))
                }
                options={essentialityOptions.map((option) => ({
                  value: option,
                  label: humanizeEnum(option)
                }))}
              />
            </div>

            <FormActions
              submitLabel={editingSubcategoryId ? "Salvar subcategoria" : "Criar subcategoria"}
              cancelLabel={editingSubcategoryId ? "Cancelar" : undefined}
              onCancel={editingSubcategoryId ? resetSubcategoryForm : undefined}
              pending={isPending}
            />
          </form>

          <div className="stack-list">
            {subcategories.data.items.map((subcategory) => (
              <div key={subcategory.id} className="stack-row">
                <div className="stack-head">
                  <strong>{subcategory.name}</strong>
                  <span>{subcategory.categoryName}</span>
                </div>
                <p>
                  {subcategory.costNature ? humanizeEnum(subcategory.costNature) : "Sem natureza"} ·{" "}
                  {subcategory.essentiality
                    ? humanizeEnum(subcategory.essentiality)
                    : "Sem essencialidade"}
                </p>
                <div className="list-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => loadSubcategory(subcategory)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => archiveSubcategory(subcategory.id)}
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Preparo fiscal e operacional" subtitle="Leituras simples para o beta">
          <div className="stack-list">
            <div className="stack-row">
              <div className="stack-head">
                <strong>Dedutiveis mapeados</strong>
                <span>{settings.data.fiscalReadiness.deductibleGroups.length}</span>
              </div>
              <p>Use essas tags quando o modulo fiscal for aberto no app.</p>
            </div>
            <div className="stack-row">
              <div className="stack-head">
                <strong>Exportacao fiscal</strong>
                <span>{settings.data.fiscalReadiness.exportMode}</span>
              </div>
              <p>Permanece protegida enquanto o fluxo fiscal nao entra no escopo do beta.</p>
            </div>
            <div className="stack-row">
              <div className="stack-head">
                <strong>Saldo inicial total</strong>
                <span>
                  {formatCurrency(
                    accounts.data.items.reduce((sum, account) => sum + account.openingBalance, 0)
                  )}
                </span>
              </div>
              <p>Referencia util para revisar se o setup inicial esta coerente.</p>
            </div>
          </div>

          <EmptyState
            title="Estrutura pronta para uso diario"
            description="Depois de ajustar contas, categorias e subcategorias, o restante do app tende a ficar bem mais rapido de alimentar."
            cta="Continuar configurando"
          />
        </SectionCard>
      </div>
    </div>
  );
}
