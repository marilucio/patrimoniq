"use client";

import { formatCurrency } from "@patrimoniq/domain";
import { EmptyModuleState, ErrorState, LoadingState } from "../../components/page-state";
import { DataTable, MiniBars, PageIntro, ProgressBar, SectionCard } from "../../components/ui";
import { useApiResource } from "../../hooks/use-api-resource";
import type { ReportsResponse } from "../../lib/api";

export function ReportsClientPage() {
  const { data, loading, error } = useApiResource<ReportsResponse>("/reports");

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="page-grid">
        <ErrorState
          title="Relatorios indisponiveis"
          description={error ?? "Nao foi possivel carregar suas leituras consolidadas."}
        />
      </div>
    );
  }

  if (data.cards.length === 0) {
    return (
      <div className="page-grid">
        <PageIntro
          eyebrow="Relatorios"
          title="Nenhum relatorio disponivel"
          description="Os relatorios sao gerados a partir das suas transacoes, metas e patrimonio."
        />
        <EmptyModuleState
          title="Sem dados suficientes"
          description="Registre mais movimentacoes para gerar comparativos e distribuicao de gastos."
          cta="Ir para transacoes"
        />
      </div>
    );
  }

  return (
    <div className="page-grid">
      <PageIntro
        eyebrow="Relatorios"
        title="Seus relatorios"
        description="Resumo do periodo, gastos por categoria, fluxo mensal e score financeiro."
      />

      <SectionCard title="Resumo do periodo" subtitle="O essencial em uma tabela objetiva">
        <DataTable
          columns={["Relatorio", "Resumo", "Valor"]}
          rows={data.cards.map((card) => [
            card.title,
            card.summary,
            <strong key={card.id}>{formatCurrency(card.metric)}</strong>
          ])}
        />
      </SectionCard>

      <div className="two-column">
        <SectionCard title="Gastos por categoria" subtitle="Onde o dinheiro se concentrou neste mes">
          <div className="stack-list">
            {data.categorySpend.map((item) => (
              <div key={item.category} className="stack-row">
                <div className="stack-head">
                  <strong>{item.category}</strong>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
                <ProgressBar value={item.share} tone={item.share > 30 ? "warning" : "default"} />
                <p>{item.share}% do total de despesas compensadas.</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Fluxo dos ultimos meses" subtitle="Entradas e saidas em perspectiva">
          <div className="trend-summary">
            <MiniBars values={data.monthlyFlow.map((item) => item.income - item.expenses)} />
            <div className="trend-legend">
              {data.monthlyFlow.map((item) => (
                <div key={item.month} className="trend-row">
                  <strong>{item.month}</strong>
                  <span>Entrou {formatCurrency(item.income)}</span>
                  <span>Saiu {formatCurrency(item.expenses)}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Score financeiro" subtitle="Evolucao disciplinar mais recente">
        {data.score ? (
          <div className="score-lines">
            <div><span>Nota geral</span><strong>{data.score.overall}</strong></div>
            <div><span>Organizacao</span><ProgressBar value={data.score.organization} tone="positive" /></div>
            <div><span>Previsibilidade</span><ProgressBar value={data.score.predictability} /></div>
            <div><span>Disciplina</span><ProgressBar value={data.score.discipline} tone="warning" /></div>
            <div><span>Protecao</span><ProgressBar value={data.score.protection} /></div>
            <div><span>Crescimento</span><ProgressBar value={data.score.growth} tone="positive" /></div>
            <div><span>Divida</span><ProgressBar value={data.score.debt} tone="warning" /></div>
          </div>
        ) : (
          <div className="soft-empty">
            <strong>Score ainda indisponivel</strong>
            <p>O score e calculado a partir do seu historico de movimentacoes.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
