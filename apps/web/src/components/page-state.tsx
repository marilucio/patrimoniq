import { EmptyState, SectionCard } from "./ui";

export function ErrorState(props: { title: string; description: string }) {
  return (
    <SectionCard title={props.title} subtitle="Algo deu errado">
      <div className="empty-state error">
        <h3>Nao foi possivel carregar</h3>
        <p>{props.description}</p>
      </div>
    </SectionCard>
  );
}

export function LoadingState() {
  return (
    <div className="page-grid">
      <SectionCard title="Carregando" subtitle="Buscando seus dados">
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
    <SectionCard title={props.title} subtitle="Nenhum registro ainda">
      <EmptyState {...props} />
    </SectionCard>
  );
}

