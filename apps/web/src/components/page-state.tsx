import { EmptyState, SectionCard } from "./ui";

export function ErrorState(props: { title: string; description: string }) {
  return (
    <SectionCard title={props.title} subtitle="Falha ao ler a API">
      <div className="empty-state error">
        <h3>Dados indisponiveis</h3>
        <p>{props.description}</p>
      </div>
    </SectionCard>
  );
}

export function LoadingState() {
  return (
    <div className="page-grid">
      <SectionCard title="Carregando" subtitle="Buscando dados reais do banco">
        <div className="stats-grid compact">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="skeleton-card" />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function EmptyModuleState(props: {
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <SectionCard title={props.title} subtitle="Sem registros no banco ainda">
      <EmptyState {...props} />
    </SectionCard>
  );
}

