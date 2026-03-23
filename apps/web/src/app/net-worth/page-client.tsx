"use client";

import { formatCurrency } from "@patrimoniq/domain";
import { useState, useTransition } from "react";
import { EmptyModuleState, ErrorState, LoadingState } from "../../components/page-state";
import {
  FeedbackBanner,
  FormActions,
  InputField,
  SelectField
} from "../../components/form-controls";
import { MiniBars, PageIntro, SectionCard, StatCard } from "../../components/ui";
import { useToast } from "../../components/toast-provider";
import { useApiResource } from "../../hooks/use-api-resource";
import {
  apiRequest,
  readApiError,
  type AccountsResponse,
  type AssetsResponse,
  type LiabilitiesResponse,
  type NetWorthResponse,
  type NetWorthSnapshotsResponse
} from "../../lib/api";
import { notifyDataChanged } from "../../lib/live-data";
import { assetTypeOptions, humanizeEnum, liabilityTypeOptions } from "../../lib/options";
import { parsePositiveAmount, parseRequiredAmount, validateIsoDate } from "../../lib/validation";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAssetForm = {
  name: "",
  type: "INVESTMENT",
  currentValue: "",
  acquisitionValue: "",
  linkedAccountId: ""
};

const emptyLiabilityForm = {
  name: "",
  type: "CREDIT_CARD",
  currentBalance: "",
  monthlyPayment: ""
};

const emptySnapshotForm = {
  snapshotDate: today(),
  totalAssets: "",
  totalLiabilities: "",
  liquidReserve: "",
  investedAssets: ""
};

export function NetWorthClientPage() {
  const netWorth = useApiResource<NetWorthResponse>("/net-worth");
  const assets = useApiResource<AssetsResponse>("/assets");
  const liabilities = useApiResource<LiabilitiesResponse>("/liabilities");
  const accounts = useApiResource<AccountsResponse>("/accounts");
  const snapshots = useApiResource<NetWorthSnapshotsResponse>("/net-worth/snapshots");
  const { showToast } = useToast();
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [liabilityForm, setLiabilityForm] = useState(emptyLiabilityForm);
  const [snapshotForm, setSnapshotForm] = useState(emptySnapshotForm);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const loading =
    netWorth.loading ||
    assets.loading ||
    liabilities.loading ||
    accounts.loading ||
    snapshots.loading;
  const error =
    netWorth.error ??
    assets.error ??
    liabilities.error ??
    accounts.error ??
    snapshots.error;

  async function refreshAll() {
    await Promise.all([
      netWorth.reload(),
      assets.reload(),
      liabilities.reload(),
      snapshots.reload()
    ]);
    notifyDataChanged();
  }

  function resetAssetForm() {
    setAssetForm(emptyAssetForm);
    setEditingAssetId(null);
  }

  function resetLiabilityForm() {
    setLiabilityForm(emptyLiabilityForm);
    setEditingLiabilityId(null);
  }

  function resetSnapshotForm() {
    setSnapshotForm(emptySnapshotForm);
    setEditingSnapshotId(null);
  }

  function loadAsset(item: AssetsResponse["items"][number]) {
    setEditingAssetId(item.id);
    setAssetForm({
      name: item.name,
      type: item.typeCode,
      currentValue: String(item.currentValue),
      acquisitionValue: item.acquisitionValue ? String(item.acquisitionValue) : "",
      linkedAccountId: item.linkedAccountId ?? ""
    });
    setFeedback(null);
  }

  function loadLiability(item: LiabilitiesResponse["items"][number]) {
    setEditingLiabilityId(item.id);
    setLiabilityForm({
      name: item.name,
      type: item.typeCode,
      currentBalance: String(item.currentBalance),
      monthlyPayment: item.monthlyPayment ? String(item.monthlyPayment) : ""
    });
    setFeedback(null);
  }

  function loadSnapshot(item: NetWorthSnapshotsResponse["items"][number]) {
    setEditingSnapshotId(item.id);
    setSnapshotForm({
      snapshotDate: item.snapshotDate,
      totalAssets: String(item.totalAssets),
      totalLiabilities: String(item.totalLiabilities),
      liquidReserve: String(item.liquidReserve),
      investedAssets: String(item.investedAssets)
    });
    setFeedback(null);
  }

  function submitAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentValueResult = parsePositiveAmount(assetForm.currentValue, "Valor atual");
    if (currentValueResult.error) {
      setFeedback({ tone: "error", message: currentValueResult.error });
      showToast({ tone: "error", message: currentValueResult.error });
      return;
    }

    startTransition(() => {
      void apiRequest(editingAssetId ? `/assets/${editingAssetId}` : "/assets", {
        method: editingAssetId ? "PATCH" : "POST",
        body: {
          name: assetForm.name,
          type: assetForm.type,
          currentValue: currentValueResult.value,
          ...(assetForm.acquisitionValue ? { acquisitionValue: Number(assetForm.acquisitionValue) } : {}),
          ...(assetForm.linkedAccountId ? { linkedAccountId: assetForm.linkedAccountId } : {})
        }
      })
        .then(async () => {
          await refreshAll();
          showToast({ tone: "success", message: editingAssetId ? "Ativo atualizado." : "Ativo criado." });
          resetAssetForm();
        })
        .catch((submitError) => {
          const message = readApiError(submitError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function submitLiability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentBalanceResult = parsePositiveAmount(liabilityForm.currentBalance, "Saldo atual");
    if (currentBalanceResult.error) {
      setFeedback({ tone: "error", message: currentBalanceResult.error });
      showToast({ tone: "error", message: currentBalanceResult.error });
      return;
    }

    startTransition(() => {
      void apiRequest(editingLiabilityId ? `/liabilities/${editingLiabilityId}` : "/liabilities", {
        method: editingLiabilityId ? "PATCH" : "POST",
        body: {
          name: liabilityForm.name,
          type: liabilityForm.type,
          currentBalance: currentBalanceResult.value,
          ...(liabilityForm.monthlyPayment ? { monthlyPayment: Number(liabilityForm.monthlyPayment) } : {})
        }
      })
        .then(async () => {
          await refreshAll();
          showToast({ tone: "success", message: editingLiabilityId ? "Divida atualizada." : "Divida criada." });
          resetLiabilityForm();
        })
        .catch((submitError) => {
          const message = readApiError(submitError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function submitSnapshot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const snapshotDateError = validateIsoDate(snapshotForm.snapshotDate, "Data");
    if (snapshotDateError) {
      setFeedback({ tone: "error", message: snapshotDateError });
      showToast({ tone: "error", message: snapshotDateError });
      return;
    }

    const totalAssetsResult = parsePositiveAmount(snapshotForm.totalAssets, "Total de ativos");
    if (totalAssetsResult.error) {
      setFeedback({ tone: "error", message: totalAssetsResult.error });
      showToast({ tone: "error", message: totalAssetsResult.error });
      return;
    }

    const totalLiabilitiesResult = parseRequiredAmount(snapshotForm.totalLiabilities, "Total de dividas");
    if (totalLiabilitiesResult.error) {
      setFeedback({ tone: "error", message: totalLiabilitiesResult.error });
      showToast({ tone: "error", message: totalLiabilitiesResult.error });
      return;
    }

    startTransition(() => {
      void apiRequest(editingSnapshotId ? `/net-worth/snapshots/${editingSnapshotId}` : "/net-worth/snapshots", {
        method: editingSnapshotId ? "PATCH" : "POST",
        body: {
          snapshotDate: snapshotForm.snapshotDate,
          totalAssets: totalAssetsResult.value,
          totalLiabilities: totalLiabilitiesResult.value,
          liquidReserve: Number(snapshotForm.liquidReserve || 0),
          investedAssets: Number(snapshotForm.investedAssets || 0)
        }
      })
        .then(async () => {
          await refreshAll();
          showToast({ tone: "success", message: editingSnapshotId ? "Snapshot atualizado." : "Snapshot criado." });
          resetSnapshotForm();
        })
        .catch((submitError) => {
          const message = readApiError(submitError);
          setFeedback({ tone: "error", message });
          showToast({ tone: "error", message });
        });
    });
  }

  function archiveAsset(id: string) {
    if (!window.confirm("Arquivar este ativo?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/assets/${id}`, { method: "DELETE" }).then(refreshAll);
    });
  }

  function archiveLiability(id: string) {
    if (!window.confirm("Arquivar esta divida?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/liabilities/${id}`, { method: "DELETE" }).then(refreshAll);
    });
  }

  function deleteSnapshot(id: string) {
    if (!window.confirm("Excluir este snapshot patrimonial?")) {
      return;
    }

    startTransition(() => {
      void apiRequest(`/net-worth/snapshots/${id}`, { method: "DELETE" }).then(refreshAll);
    });
  }

  function generateMonthlySnapshot() {
    startTransition(() => {
      void apiRequest("/net-worth/snapshots/generate-monthly", { method: "POST", body: {} }).then(refreshAll);
    });
  }

  if (loading) {
    return <LoadingState />;
  }

  if (
    error ||
    !netWorth.data ||
    !assets.data ||
    !liabilities.data ||
    !accounts.data ||
    !snapshots.data
  ) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Patrimonio indisponivel"
          description={error ?? "Nao foi possivel carregar seus dados patrimoniais."}
        />
      </div>
    );
  }

  const assetsTotal = netWorth.data.assets.reduce((sum, item) => sum + item.value, 0);
  const liabilitiesTotal = netWorth.data.liabilities.reduce((sum, item) => sum + item.balance, 0);

  if (netWorth.data.assets.length === 0 && netWorth.data.liabilities.length === 0) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Patrimonio"
          title="Seu patrimonio ainda nao foi mapeado"
          description="Cadastre ativos e dividas para acompanhar sua riqueza real."
        />
        <div className="two-column">
          <SectionCard title="Novo ativo" subtitle="Comece pelo principal">
            <form className="editor-form" onSubmit={submitAsset}>
              <InputField label="Nome" value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} required />
              <InputField label="Valor atual" type="number" min="0" step="0.01" value={assetForm.currentValue} onChange={(event) => setAssetForm((current) => ({ ...current, currentValue: event.target.value }))} required />
              <FormActions submitLabel="Criar ativo" pending={isPending} />
              {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}
            </form>
          </SectionCard>
          <EmptyModuleState
            title="Sem patrimonio registrado"
            description="Adicione ativos e dividas para ver o patrimonio liquido."
            cta="Criar primeiro ativo"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro eyebrow="Patrimonio" title="Seu valor real em foco" description="Ativos, dividas e snapshots em uma experiencia simples." />

      <section className="stats-grid compact">
        <StatCard label="Ativos" value={formatCurrency(assetsTotal)} helper="O que voce possui" tone="positive" />
        <StatCard label="Dividas" value={formatCurrency(liabilitiesTotal)} helper="O que ainda precisa pagar" tone="warning" />
        <StatCard label="Patrimonio liquido" value={formatCurrency(netWorth.data.netWorth)} helper="Ativos menos dividas" tone="positive" />
        <StatCard label="Snapshots" value={String(snapshots.data.items.length)} helper="Historico salvo" />
      </section>

      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      <SectionCard title="Linha do tempo patrimonial" subtitle="Evolucao mensal registrada">
        <div className="trend-summary">
          <MiniBars values={netWorth.data.timeline.map((item) => item.netWorth)} />
          <div className="trend-legend">
            {netWorth.data.timeline.map((item) => (
              <div key={`${item.month}-${item.netWorth}`} className="trend-row">
                <strong>{item.month}</strong>
                <span>Patrimonio {formatCurrency(item.netWorth)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="two-column">
        <SectionCard title={editingAssetId ? "Editar ativo" : "Novo ativo"} subtitle="Bens, caixa e investimentos">
          <form className="editor-form" onSubmit={submitAsset}>
            <div className="form-grid">
              <InputField label="Nome" value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} required />
              <SelectField label="Tipo" value={assetForm.type} onChange={(event) => setAssetForm((current) => ({ ...current, type: event.target.value }))} options={assetTypeOptions.map((option) => ({ value: option, label: humanizeEnum(option) }))} />
              <InputField label="Valor atual" type="number" min="0" step="0.01" value={assetForm.currentValue} onChange={(event) => setAssetForm((current) => ({ ...current, currentValue: event.target.value }))} required />
              <InputField label="Valor de aquisicao" type="number" min="0" step="0.01" value={assetForm.acquisitionValue} onChange={(event) => setAssetForm((current) => ({ ...current, acquisitionValue: event.target.value }))} />
              <SelectField label="Conta vinculada" value={assetForm.linkedAccountId} onChange={(event) => setAssetForm((current) => ({ ...current, linkedAccountId: event.target.value }))} options={accounts.data.items.map((account) => ({ value: account.id, label: account.name }))} />
            </div>
            <FormActions submitLabel={editingAssetId ? "Salvar ativo" : "Criar ativo"} cancelLabel={editingAssetId ? "Cancelar" : undefined} onCancel={editingAssetId ? resetAssetForm : undefined} pending={isPending} />
          </form>
          <div className="stack-list">
            {assets.data.items.map((asset) => (
              <div key={asset.id} className="stack-row">
                <div className="stack-head">
                  <strong>{asset.name}</strong>
                  <span>{asset.type}</span>
                </div>
                <p>{formatCurrency(asset.currentValue)}</p>
                <div className="list-actions">
                  <button type="button" className="ghost-button" onClick={() => loadAsset(asset)}>Editar</button>
                  <button type="button" className="danger-button" onClick={() => archiveAsset(asset.id)}>Arquivar</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={editingLiabilityId ? "Editar divida" : "Nova divida"} subtitle="Passivos que reduzem seu patrimonio">
          <form className="editor-form" onSubmit={submitLiability}>
            <div className="form-grid">
              <InputField label="Nome" value={liabilityForm.name} onChange={(event) => setLiabilityForm((current) => ({ ...current, name: event.target.value }))} required />
              <SelectField label="Tipo" value={liabilityForm.type} onChange={(event) => setLiabilityForm((current) => ({ ...current, type: event.target.value }))} options={liabilityTypeOptions.map((option) => ({ value: option, label: humanizeEnum(option) }))} />
              <InputField label="Saldo atual" type="number" min="0" step="0.01" value={liabilityForm.currentBalance} onChange={(event) => setLiabilityForm((current) => ({ ...current, currentBalance: event.target.value }))} required />
              <InputField label="Parcela mensal" type="number" min="0" step="0.01" value={liabilityForm.monthlyPayment} onChange={(event) => setLiabilityForm((current) => ({ ...current, monthlyPayment: event.target.value }))} />
            </div>
            <FormActions submitLabel={editingLiabilityId ? "Salvar divida" : "Criar divida"} cancelLabel={editingLiabilityId ? "Cancelar" : undefined} onCancel={editingLiabilityId ? resetLiabilityForm : undefined} pending={isPending} />
          </form>
          <div className="stack-list">
            {liabilities.data.items.map((item) => (
              <div key={item.id} className="stack-row">
                <div className="stack-head">
                  <strong>{item.name}</strong>
                  <span>{item.type}</span>
                </div>
                <p>Saldo {formatCurrency(item.currentBalance)} · parcela {formatCurrency(item.monthlyPayment)}</p>
                <div className="list-actions">
                  <button type="button" className="ghost-button" onClick={() => loadLiability(item)}>Editar</button>
                  <button type="button" className="danger-button" onClick={() => archiveLiability(item.id)}>Arquivar</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title={editingSnapshotId ? "Editar snapshot" : "Novo snapshot"} subtitle="Historico manual do patrimonio">
          <form className="editor-form" onSubmit={submitSnapshot}>
            <div className="form-grid">
              <InputField label="Data" type="date" value={snapshotForm.snapshotDate} onChange={(event) => setSnapshotForm((current) => ({ ...current, snapshotDate: event.target.value }))} required />
              <InputField label="Total de ativos" type="number" min="0" step="0.01" value={snapshotForm.totalAssets} onChange={(event) => setSnapshotForm((current) => ({ ...current, totalAssets: event.target.value }))} required />
              <InputField label="Total de dividas" type="number" min="0" step="0.01" value={snapshotForm.totalLiabilities} onChange={(event) => setSnapshotForm((current) => ({ ...current, totalLiabilities: event.target.value }))} required />
              <InputField label="Reserva liquida" type="number" min="0" step="0.01" value={snapshotForm.liquidReserve} onChange={(event) => setSnapshotForm((current) => ({ ...current, liquidReserve: event.target.value }))} />
              <InputField label="Investidos" type="number" min="0" step="0.01" value={snapshotForm.investedAssets} onChange={(event) => setSnapshotForm((current) => ({ ...current, investedAssets: event.target.value }))} />
            </div>
            <FormActions submitLabel={editingSnapshotId ? "Salvar snapshot" : "Criar snapshot"} cancelLabel={editingSnapshotId ? "Cancelar" : undefined} onCancel={editingSnapshotId ? resetSnapshotForm : undefined} pending={isPending} />
          </form>
          <div className="list-actions">
            <button type="button" className="ghost-button" onClick={generateMonthlySnapshot}>Gerar snapshot do mes</button>
          </div>
        </SectionCard>

        <SectionCard title="Historico de snapshots" subtitle="Pontos salvos da sua linha do tempo">
          <div className="stack-list">
            {snapshots.data.items.map((snapshot) => (
              <div key={snapshot.id} className="stack-row">
                <div className="stack-head">
                  <strong>{snapshot.snapshotDate}</strong>
                  <span>{formatCurrency(snapshot.netWorth)}</span>
                </div>
                <p>Ativos {formatCurrency(snapshot.totalAssets)} · dividas {formatCurrency(snapshot.totalLiabilities)}</p>
                <div className="list-actions">
                  <button type="button" className="ghost-button" onClick={() => loadSnapshot(snapshot)}>Editar</button>
                  <button type="button" className="danger-button" onClick={() => deleteSnapshot(snapshot.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
