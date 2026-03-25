"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { calculateGoalProgress, formatCurrency } from "@patrimoniq/domain";
import { ErrorState, LoadingState } from "../../components/page-state";
import { EmptyState, PageIntro, ProgressBar, SectionCard, StatCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import {
  apiRequest,
  type AlertItem,
  type AlertsResponse,
  type DashboardResponse
} from "../../lib/api";

const severityTone: Record<string, string> = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info"
};

function AlertsStrip(props: {
  alerts: AlertItem[];
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
}) {
  if (props.alerts.length === 0) return null;

  return (
    <div className="alerts-strip" role="region" aria-label="Alertas financeiros">
      {props.alerts.slice(0, 5).map((alert) => (
        <article
          key={alert.id}
          className={`alert-card ${severityTone[alert.severity] ?? "info"}`}
        >
          <div className="alert-content">
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
            {alert.recommendation ? (
              <div className="alert-recommendation">
                <p><strong>O que aconteceu:</strong> {alert.recommendation.whatHappened}</p>
                <p><strong>Por que importa:</strong> {alert.recommendation.whyItMatters}</p>
                <p><strong>O que fazer agora:</strong> {alert.recommendation.whatToDoNow}</p>
                <p><strong>Revisar novamente:</strong> {alert.recommendation.reviewAt}</p>
                {alert.recommendation.impactEstimate ? (
                  <p><strong>Impacto estimado:</strong> {alert.recommendation.impactEstimate}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="alert-actions">
            {alert.actionRoute ? (
              <Link href={alert.actionRoute} className="inline-link">
                {alert.actionLabel ?? "Ver"}
              </Link>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={() => props.onAcknowledge(alert.id)}
              aria-label={`Marcar alerta como lido: ${alert.title}`}
            >
              Marcar como lido
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => props.onDismiss(alert.id)}
              aria-label={`Dispensar alerta: ${alert.title}`}
            >
              Dispensar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function OnboardingCard(props: { onboarding: DashboardResponse["onboarding"] }) {
  const progress = (props.onboarding.completedSteps / props.onboarding.totalSteps) * 100;

  return (
    <SectionCard
      title="Primeiros passos"
      subtitle="Configure o essencial para comecar a usar"
      className="subtle-card"
      actions={
        <span className="pill">
          {props.onboarding.completedSteps}/{props.onboarding.totalSteps} concluido(s)
        </span>
      }
    >
      {props.onboarding.nextStep ? (
        <div className="soft-empty onboarding-focus">
          <strong>{props.onboarding.nextStep.title}</strong>
          <p>{props.onboarding.nextStep.description ?? props.onboarding.nudge}</p>
          <Link href={props.onboarding.nextStep.href} className="inline-link">
            {props.onboarding.nextStep.cta}
          </Link>
        </div>
      ) : null}

      <ProgressBar
        value={progress}
        label="Progresso da configuracao"
        tone={progress >= 100 ? "positive" : "default"}
      />

      <div className="stack-list">
        {props.onboarding.steps.map((step) => (
          <article key={step.id} className="stack-row checklist-row">
            <div className="checklist-copy">
              <span className={step.done ? "checklist-badge done" : "checklist-badge"}>
                {step.done ? "Feito" : "Pendente"}
              </span>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
            {!step.done ? (
              <Link href={step.href} className="inline-link">
                {step.cta}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function DashboardGuideCard(props: { guide: string[] }) {
  return (
    <SectionCard
      title="Como usar o Patrimoniq"
      subtitle="Guia rapido para comecar"
      className="subtle-card"
    >
      <div className="guide-list">
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Comece pelas configuracoes:</strong> crie sua conta bancaria e revise as categorias.</p>
        </article>
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Lance receitas e despesas:</strong> cada lancamento atualiza automaticamente o painel.</p>
        </article>
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Crie uma meta:</strong> defina um valor-alvo e acompanhe o progresso.</p>
        </article>
      </div>

      <div className="guide-divider" />

      <div className="guide-list">
        <p className="guide-section-title">Leitura do painel</p>
        {props.guide.map((item) => (
          <article key={item} className="guide-row">
            <span className="guide-dot" />
            <p>{item}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function AdvisorActionPlanCard(props: {
  advisor: DashboardResponse["advisor"];
  onTrackInteraction: (id: string, kind: "open" | "done", route: string) => void;
}) {
  return (
    <SectionCard
      title={props.advisor.monthlyActionPlan.title}
      subtitle={props.advisor.monthlyActionPlan.subtitle}
      className="subtle-card"
    >
      <div className="advisor-strip">
        <article className={`advisor-risk ${props.advisor.riskSummary.level}`}>
          <strong>{props.advisor.riskSummary.label}</strong>
          <p>{props.advisor.riskSummary.description}</p>
          <span>Score de risco: {props.advisor.riskSummary.score}/100</span>
        </article>
        <article className="advisor-priority">
          <strong>Prioridade da semana</strong>
          <p>{props.advisor.priorityOfWeek.title}</p>
          <span>Principal atencao: {props.advisor.mainAttention}</span>
        </article>
      </div>

      <div className="stack-list">
        {props.advisor.monthlyActionPlan.actions.map((action) => (
          <article key={action.id} className="stack-row advisor-action-row">
            <div className="stack-head">
              <strong>{action.title}</strong>
              <span>Prioridade {action.score}</span>
            </div>
            <p>{action.reason}</p>
            <p>{action.impactEstimate}</p>
            {action.dueDate ? <p>Revisar em {action.dueDate}</p> : null}
            <div className="alert-actions">
              <Link
                href={action.route}
                className="inline-link"
                onClick={() => props.onTrackInteraction(action.id, "open", action.route)}
              >
                {action.cta}
              </Link>
              <button
                type="button"
                className="ghost-button"
                onClick={() => props.onTrackInteraction(action.id, "done", action.route)}
              >
                Marcar como concluido
              </button>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function AdvisorRoutineCard(props: { routine: DashboardResponse["advisor"]["routine"] }) {
  return (
    <SectionCard
      title="Rotina financeira"
      subtitle="Ritmo leve para manter consistencia"
      className="subtle-card"
    >
      <div className="guide-list">
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Prioridade da semana:</strong> {props.routine.weeklyPriority}</p>
        </article>
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Revisao do mes:</strong> {props.routine.monthReview}</p>
        </article>
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Consistencia de metas:</strong> {props.routine.goalConsistency}</p>
        </article>
        <article className="guide-row">
          <span className="guide-dot" />
          <p><strong>Lembrete:</strong> {props.routine.followUpReminder}</p>
        </article>
      </div>
    </SectionCard>
  );
}

export function DashboardClientPage() {
  const { data, loading, error } = useApiResource<DashboardResponse>("/dashboard/overview");
  const alerts = useApiResource<AlertsResponse>("/alerts");
  const [, startTransition] = useTransition();

  // Trigger alert evaluation on dashboard load
  useEffect(() => {
    void apiRequest("/alerts/evaluate", { method: "POST" }).then(() => {
      void alerts.reload();
    }).catch(() => {
      // Silent — alerts are non-critical
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissAlert(id: string) {
    startTransition(() => {
      void apiRequest(`/alerts/${id}/dismiss`, { method: "POST" }).then(() => {
        void alerts.reload();
      });
    });
  }

  function acknowledgeAlert(id: string) {
    startTransition(() => {
      void apiRequest(`/alerts/${id}/acknowledge`, { method: "POST" }).then(() => {
        void alerts.reload();
      });
    });
  }

  function trackActionPlanInteraction(id: string, kind: "open" | "done", route: string) {
    startTransition(() => {
      void apiRequest(`/dashboard/action-plan/${encodeURIComponent(id)}/interaction`, {
        method: "POST",
        body: { kind, route }
      });
    });
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Visao geral indisponivel"
          description={error ?? "Nao foi possivel carregar seu resumo financeiro."}
        />
      </div>
    );
  }

  const activeAlerts = (alerts.data?.items ?? []).filter((a) => !a.isRead);

  const emptyState =
    data.summary.income === 0 &&
    data.summary.expenses === 0 &&
    data.goals.length === 0 &&
    data.upcomingBills.length === 0;

  if (emptyState) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Visao geral"
          title={`Bem-vindo, ${data.userName}`}
          description="Complete os passos abaixo para ativar seu painel financeiro."
        />
        <div className="two-column">
          <OnboardingCard onboarding={data.onboarding} />
          <DashboardGuideCard guide={data.onboarding.dashboardGuide} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Visao geral"
        title={`${data.userName}, este e o essencial do seu mes`}
        description="Saldo, compromissos e progresso das suas metas em um so lugar."
        actions={<div className="hero-chip">Atualizado em {data.referenceMonth}</div>}
      />

      <AlertsStrip
        alerts={activeAlerts}
        onDismiss={dismissAlert}
        onAcknowledge={acknowledgeAlert}
      />

      <div className="two-column">
        <AdvisorActionPlanCard
          advisor={data.advisor}
          onTrackInteraction={trackActionPlanInteraction}
        />
        <AdvisorRoutineCard routine={data.advisor.routine} />
      </div>

      <section className="dashboard-hero">
        <div className="dashboard-balance">
          <span className="eyebrow">Saldo do mes</span>
          <strong>{formatCurrency(data.summary.balanceMonth)}</strong>
          <p>
            Resultado acumulado do mes ate o momento.
          </p>

          <div className="metric-strip">
            <article className="metric-tile positive">
              <span>Entrou</span>
              <strong>{formatCurrency(data.summary.income)}</strong>
            </article>
            <article className="metric-tile">
              <span>Saiu</span>
              <strong>{formatCurrency(data.summary.expenses)}</strong>
            </article>
            <article
              className={data.summary.leftover >= 0 ? "metric-tile positive" : "metric-tile warning"}
            >
              <span>Quanto sobra</span>
              <strong>{formatCurrency(data.summary.leftover)}</strong>
            </article>
          </div>
        </div>

        <div className="dashboard-side-panel">
          <div className="focus-inline">
            <span>Contas a vencer</span>
            <strong>{formatCurrency(data.summary.upcomingBillsAmount)}</strong>
          </div>
          <div className="focus-inline">
            <span>Patrimonio liquido</span>
            <strong>{formatCurrency(data.summary.netWorth)}</strong>
          </div>
          <p>
            {data.upcomingBills.length > 0
              ? `${data.upcomingBills.length} compromisso(s) pendente(s) neste mes.`
              : "Nenhum compromisso pendente neste mes."}
          </p>
        </div>
      </section>

      {!data.onboarding.isComplete ? (
        <div className="two-column">
          <OnboardingCard onboarding={data.onboarding} />
          <DashboardGuideCard guide={data.onboarding.dashboardGuide} />
        </div>
      ) : null}

      <div className="dashboard-grid">
        <SectionCard
          title="Contas a vencer"
          subtitle="Compromissos pendentes no periodo"
          className="subtle-card"
        >
          {data.upcomingBills.length > 0 ? (
            <div className="stack-list">
              {data.upcomingBills.map((bill) => (
                <article key={bill.id} className="stack-row">
                  <div className="stack-head">
                    <strong>{bill.description}</strong>
                    <span>{formatCurrency(bill.amount)}</span>
                  </div>
                  <p>Vence em {bill.dueDate}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum compromisso pendente"
              description="Voce nao tem contas a vencer neste periodo."
              cta="Tudo em dia"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Metas em destaque"
          subtitle="Progresso das suas metas ativas"
          className="subtle-card"
        >
          {data.goals.length > 0 ? (
            <div className="stack-list">
              {data.goals.map((goal) => (
                <div key={goal.id} className="stack-row">
                  <div className="stack-head">
                    <strong>{goal.name}</strong>
                    <span>{Math.round(calculateGoalProgress(goal))}%</span>
                  </div>
                  <ProgressBar value={calculateGoalProgress(goal)} tone="positive" />
                  <p>
                    {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                    {goal.targetDate ? ` · alvo em ${goal.targetDate}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma meta ativa"
              description="Crie uma meta para acompanhar seu progresso."
              cta="Ir para metas"
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Insights uteis"
        subtitle="Indicadores relevantes para suas decisoes"
        className="subtle-card"
      >
        <div className="insight-grid">
          <StatCard
            label="Patrimonio liquido"
            value={formatCurrency(data.summary.netWorth)}
            helper="Sua riqueza real agora"
          />
          <div className="stack-list">
            {data.insights.slice(0, 4).map((insight) => (
              <article key={insight.id} className="stack-row insight-row">
                <strong>{insight.title}</strong>
                <p>{insight.description}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
