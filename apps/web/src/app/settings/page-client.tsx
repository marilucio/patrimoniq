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
import { PageIntro, SectionCard } from "../../components/ui";
import { useToast } from "../../components/toast-provider";
import { useApiResource } from "../../hooks/use-api-resource";
import {
  apiRequest,
  readApiError,
  type AccountsResponse,
  type CategoriesResponse,
  type PasswordChangeResponse,
  type PreferencesResponse,
  type ProfileUpdateResponse,
  type SessionsResponse,
  type SettingsResponse,
  type SubcategoriesResponse
} from "../../lib/api";
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

const localeOptions = [
  { value: "pt-BR", label: "Portugues (Brasil)" },
  { value: "en-US", label: "English (US)" }
];

const currencyOptions = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dolar (USD)" },
  { value: "EUR", label: "Euro (EUR)" }
];

const dateFormatOptions = [
  { value: "DD/MM/YYYY", label: "DD/MM/AAAA" },
  { value: "MM/DD/YYYY", label: "MM/DD/AAAA" },
  { value: "YYYY-MM-DD", label: "AAAA-MM-DD" }
];

function readStoredPreference(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(`patrimoniq_${key}`) ?? fallback;
}

function storePreference(key: string, value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`patrimoniq_${key}`, value);
  }
}

function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Navegador desconhecido";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Navegador";
}

export function SettingsClientPage() {
  const settings = useApiResource<SettingsResponse>("/settings");
  const accounts = useApiResource<AccountsResponse>("/accounts");
  const categories = useApiResource<CategoriesResponse>("/categories");
  const subcategories = useApiResource<SubcategoriesResponse>("/subcategories");
  const sessions = useApiResource<SessionsResponse>("/settings/sessions");
  const { showToast } = useToast();

  // Profile form
  const [profileName, setProfileName] = useState("");
  const [profileLocale, setProfileLocale] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Preferences form
  const [prefCurrency, setPrefCurrency] = useState(() =>
    readStoredPreference("currency", "BRL")
  );
  const [prefDateFormat, setPrefDateFormat] = useState(() =>
    readStoredPreference("dateFormat", "DD/MM/YYYY")
  );
  const [prefFeedback, setPrefFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // CRUD forms
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
    settings.loading || accounts.loading || categories.loading || subcategories.loading;
  const error = settings.error ?? accounts.error ?? categories.error ?? subcategories.error;

  // Sync profile form when settings load
  const profile = settings.data?.profile;
  if (profile && !profileDirty && profileName === "" && profileLocale === "") {
    setProfileName(profile.fullName);
    setProfileLocale(profile.locale);
  }

  async function refreshAll() {
    await Promise.all([
      settings.reload(),
      accounts.reload(),
      categories.reload(),
      subcategories.reload()
    ]);
    notifyDataChanged();
  }

  // ── Profile ──

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileFeedback(null);

    startTransition(() => {
      void apiRequest<ProfileUpdateResponse>("/settings/profile", {
        method: "PATCH",
        body: {
          fullName: profileName,
          locale: profileLocale
        }
      })
        .then(async (response) => {
          setProfileFeedback({ tone: "success", message: response.message });
          setProfileDirty(false);
          showToast({ tone: "success", message: response.message });
          await settings.reload();
          notifyDataChanged();
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setProfileFeedback({ tone: "error", message });
        });
    });
  }

  // ── Password ──

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({
        tone: "error",
        message: "A nova senha precisa ter pelo menos 8 caracteres."
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        tone: "error",
        message: "As senhas digitadas nao coincidem."
      });
      return;
    }

    startTransition(() => {
      void apiRequest<PasswordChangeResponse>("/settings/password", {
        method: "POST",
        body: { currentPassword, newPassword }
      })
        .then((response) => {
          setPasswordFeedback({ tone: "success", message: response.message });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          showToast({ tone: "success", message: response.message });
          void sessions.reload();
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setPasswordFeedback({ tone: "error", message });
        });
    });
  }

  // ── Sessions ──

  function revokeOtherSessions() {
    if (!window.confirm("Encerrar todas as outras sessoes ativas?")) return;

    startTransition(() => {
      void apiRequest<{ success: boolean; message: string }>("/settings/sessions/revoke-others", {
        method: "POST"
      })
        .then((response) => {
          showToast({ tone: "success", message: response.message });
          void sessions.reload();
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  // ── Preferences ──

  function submitPreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrefFeedback(null);

    startTransition(() => {
      void apiRequest<PreferencesResponse>("/settings/preferences", {
        method: "PATCH",
        body: { currency: prefCurrency, dateFormat: prefDateFormat }
      })
        .then((response) => {
          storePreference("currency", response.preferences.currency);
          storePreference("dateFormat", response.preferences.dateFormat);
          setPrefFeedback({ tone: "success", message: response.message });
          showToast({ tone: "success", message: response.message });
        })
        .catch((requestError) => {
          const message = readApiError(requestError);
          setPrefFeedback({ tone: "error", message });
        });
    });
  }

  // ── Account / Category / Subcategory CRUD ──

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
    if (!window.confirm("Arquivar esta conta?")) return;

    startTransition(() => {
      void apiRequest(`/accounts/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingAccountId === id) resetAccountForm();
          showToast({ tone: "success", message: "Conta arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  function archiveCategory(id: string) {
    if (!window.confirm("Arquivar esta categoria e suas subcategorias?")) return;

    startTransition(() => {
      void apiRequest(`/categories/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingCategoryId === id) resetCategoryForm();
          showToast({ tone: "success", message: "Categoria arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
        });
    });
  }

  function archiveSubcategory(id: string) {
    if (!window.confirm("Arquivar esta subcategoria?")) return;

    startTransition(() => {
      void apiRequest(`/subcategories/${id}`, { method: "DELETE" })
        .then(async () => {
          await refreshAll();
          if (editingSubcategoryId === id) resetSubcategoryForm();
          showToast({ tone: "success", message: "Subcategoria arquivada." });
        })
        .catch((requestError) => {
          showToast({ tone: "error", message: readApiError(requestError) });
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
    !subcategories.data
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

  const sessionItems = sessions.data?.sessions ?? [];
  const otherSessionCount = sessionItems.filter((s) => !s.isCurrent).length;

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Configuracoes"
        title="Sua conta"
        description="Gerencie seu perfil, seguranca, preferencias e estrutura financeira."
      />

      {/* ── Profile + Password ── */}
      <div className="two-column">
        <SectionCard title="Perfil" subtitle="Seus dados pessoais">
          <form className="editor-form" onSubmit={submitProfile}>
            <div className="form-grid">
              <InputField
                label="Nome completo"
                value={profileName}
                onChange={(event) => {
                  setProfileName(event.target.value);
                  setProfileDirty(true);
                }}
                required
                minLength={3}
                aria-label="Nome completo"
              />
              <SelectField
                label="Idioma"
                value={profileLocale}
                onChange={(event) => {
                  setProfileLocale(event.target.value);
                  setProfileDirty(true);
                }}
                options={localeOptions}
                aria-label="Idioma da conta"
              />
              <InputField
                label="E-mail"
                value={profile?.email ?? ""}
                disabled
                hint="O e-mail nao pode ser alterado"
                aria-label="E-mail da conta"
              />
            </div>

            {profileFeedback ? (
              <FeedbackBanner tone={profileFeedback.tone} message={profileFeedback.message} />
            ) : null}

            <FormActions submitLabel="Salvar perfil" pending={isPending} />
          </form>
        </SectionCard>

        <SectionCard title="Senha" subtitle="Altere sua senha de acesso">
          <form className="editor-form" onSubmit={submitPassword}>
            <div className="form-grid">
              <InputField
                label="Senha atual"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
                aria-label="Senha atual"
              />
              <InputField
                label="Nova senha"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                hint="Minimo 8 caracteres"
                autoComplete="new-password"
                aria-label="Nova senha"
              />
              <InputField
                label="Confirmar nova senha"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                aria-label="Confirmar nova senha"
              />
            </div>

            {passwordFeedback ? (
              <FeedbackBanner tone={passwordFeedback.tone} message={passwordFeedback.message} />
            ) : null}

            <FormActions submitLabel="Alterar senha" pending={isPending} />
          </form>
        </SectionCard>
      </div>

      {/* ── Security + Preferences ── */}
      <div className="two-column">
        <SectionCard
          title="Seguranca"
          subtitle="Sessoes ativas na sua conta"
          actions={
            otherSessionCount > 0 ? (
              <button
                type="button"
                className="danger-button"
                onClick={revokeOtherSessions}
                disabled={isPending}
                aria-label="Encerrar outras sessoes"
              >
                Encerrar outras sessoes
              </button>
            ) : null
          }
        >
          {sessions.loading ? (
            <p className="muted-text">Carregando sessoes...</p>
          ) : sessionItems.length === 0 ? (
            <p className="muted-text">Nenhuma sessao ativa encontrada.</p>
          ) : (
            <div className="stack-list">
              {sessionItems.map((session) => (
                <div key={session.id} className="stack-row">
                  <div className="stack-head">
                    <strong>
                      {summarizeUserAgent(session.userAgent)}
                      {session.isCurrent ? " (esta sessao)" : ""}
                    </strong>
                    <span>{session.ipAddress ?? "IP desconhecido"}</span>
                  </div>
                  <p>
                    Ultimo acesso em {formatSessionDate(session.lastSeenAt)} · criada em{" "}
                    {formatSessionDate(session.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Preferencias" subtitle="Moeda e formato de data">
          <form className="editor-form" onSubmit={submitPreferences}>
            <div className="form-grid">
              <SelectField
                label="Moeda"
                value={prefCurrency}
                onChange={(event) => setPrefCurrency(event.target.value)}
                options={currencyOptions}
                aria-label="Moeda padrao"
              />
              <SelectField
                label="Formato de data"
                value={prefDateFormat}
                onChange={(event) => setPrefDateFormat(event.target.value)}
                options={dateFormatOptions}
                aria-label="Formato de data"
              />
            </div>

            {prefFeedback ? (
              <FeedbackBanner tone={prefFeedback.tone} message={prefFeedback.message} />
            ) : null}

            <FormActions submitLabel="Salvar preferencias" pending={isPending} />
          </form>
        </SectionCard>
      </div>

      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      {/* ── Accounts + Categories ── */}
      <div className="two-column">
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

      {/* ── Subcategories ── */}
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
      </div>
    </div>
  );
}
