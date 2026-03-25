"use client";

import { ErrorState } from "../components/page-state";

export default function GlobalError() {
  return (
    <div className="page-grid">
      <ErrorState
        title="Erro geral"
        description="Ocorreu um erro inesperado. Tente recarregar a pagina."
      />
    </div>
  );
}

