"use client";

import Link from "next/link";
import { calculateGoalProgress, formatCurrency } from "@patrimoniq/domain";
import { ErrorState, LoadingState } from "../../components/page-state";
import { EmptyState, PageIntro, ProgressBar, SectionCard, StatCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import type { DashboardResponse } from "../../lib/api";

function OnboardingCard(props: { onboarding: DashboardResponse["onboarding"] }) {
  const progress = (props.onboarding.completedSteps / props.onboarding.totalSteps) * 100;

  return (
    <SectionCard
      title="Primeiros passos"
      subtitle="Um onboarding leve para deixar sua base pronta logo no primeiro acesso"
      className="subtle-card"
      actions={
        <span className="pill">
          {props.onboarding.completedSteps}/{props.onboarding.totalSteps} concluido(s)
        </span>
      }
    >
      {props.onboarding.nextStep ? (
        <div className="soft-empty onboarding-focus">
          <strong>Faca isso agora: {props.onboarding.nextStep.title}</strong>
          <p>{props.onboarding.nudge}</p>
          <Link href={props.onboarding.nextStep.href} className="inline-link">
            {props.onboarding.nextStep.cta}
          </Link>
        </div>
      ) : null}

      <ProgressBar
        value={progress}
        label="Progresso do setup inicial"
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
      title="Como ler este painel"
      subtitle="So o essencial para entender o que aparece na sua primeira semana"
      className="subtle-card"
    >
      <div className="guide-list">
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

export function DashboardClientPage() {
  const { data, loading, error } = useApiResource<DashboardResponse>("/dashboard/overview");

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
          title="Seu painel ainda esta vazio"
          description="Comece com poucos passos: conta principal, primeira receita, primeira despesa e uma meta simples. Em poucos minutos o painel ja fica util."
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
        description="Um painel mais limpo para voce bater o olho no saldo, nas contas que ainda podem apertar e no progresso do que importa."
        actions={<div className="hero-chip">Atualizado em {data.referenceMonth}</div>}
      />

      <section className="dashboard-hero">
        <div className="dashboard-balance">
          <span className="eyebrow">Saldo do mes</span>
          <strong>{formatCurrency(data.summary.balanceMonth)}</strong>
          <p>
            Esse e o que o mes ja entregou ate aqui, com uma leitura mais direta e sem excesso de
            indicador.
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
              ? `${data.upcomingBills.length} compromisso(s) ainda podem mexer no fechamento deste mes.`
              : "Sem contas futuras relevantes cadastradas neste momento."}
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
          subtitle="O que ainda pode apertar seu fechamento"
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
              title="Nenhuma conta futura relevante"
              description="Seu restante do mes esta sem compromissos pendentes cadastrados."
              cta="Fluxo sob controle"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Metas em destaque"
          subtitle="O que esta em andamento e merece atencao"
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
              title="Voce ainda nao tem metas ativas"
              description="Cadastre uma reserva ou objetivo para acompanhar o progresso aqui."
              cta="Criar primeira meta"
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Insights uteis"
        subtitle="Poucos sinais, mas com contexto para agir"
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
