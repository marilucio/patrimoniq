import type { PropsWithChildren, ReactNode } from "react";

export function PageIntro(props: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div>
        <span className="eyebrow">{props.eyebrow}</span>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
      {props.actions ? <div className="page-intro-actions">{props.actions}</div> : null}
    </section>
  );
}

export function SectionCard(
  props: PropsWithChildren<{
    title: string;
    subtitle?: string;
    className?: string;
    actions?: ReactNode;
  }>
) {
  return (
    <section className={props.className ? `section-card ${props.className}` : "section-card"}>
      <header className="section-header">
        <div>
          <h3>{props.title}</h3>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>
        {props.actions ? <div className="section-actions">{props.actions}</div> : null}
      </header>
      {props.children}
    </section>
  );
}

export function StatCard(props: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  return (
    <article className={props.tone ? `stat-card ${props.tone}` : "stat-card"}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <p>{props.helper}</p>
    </article>
  );
}

export function ProgressBar(props: { value: number; label?: string; tone?: "default" | "warning" | "critical" | "positive" }) {
  return (
    <div className="progress-group">
      {props.label ? <div className="progress-label">{props.label}</div> : null}
      <div className="progress-track">
        <div
          className={props.tone ? `progress-fill ${props.tone}` : "progress-fill"}
          style={{ width: `${Math.min(props.value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DeltaChip(props: { value: number }) {
  const tone = props.value > 0 ? "negative" : "positive";
  const signal = props.value > 0 ? "+" : "";

  return <span className={`delta-chip ${tone}`}>{`${signal}${props.value.toFixed(1)}%`}</span>;
}

export function MiniBars(props: { values: number[] }) {
  const max = Math.max(...props.values, 1);

  return (
    <div className="mini-bars">
      {props.values.map((value, index) => (
        <div key={`${value}-${index}`} className="mini-bar">
          <span style={{ height: `${(value / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

export function DataTable(props: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState(props: { title: string; description: string; cta: string }) {
  return (
    <div className="empty-state">
      <h3>{props.title}</h3>
      <p>{props.description}</p>
      <span className="empty-state-tag">{props.cta}</span>
    </div>
  );
}
