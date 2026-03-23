"use client";

import { ErrorState } from "../components/page-state";

export default function GlobalError() {
  return (
    <div className="page-grid">
      <ErrorState
        title="Erro geral"
        description="A aplicacao nao conseguiu concluir a leitura da API nesta navegacao."
      />
    </div>
  );
}

