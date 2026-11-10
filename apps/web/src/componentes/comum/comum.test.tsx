import { MENSAGEM_ERRO_INTERNO } from "@erp/shared/erros";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErroDaApi } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { KpiCard, statusDaMeta } from "./KpiCard";
import { MensagemErro } from "./MensagemErro";
import { SeloAtualizacao } from "./SeloAtualizacao";

afterEach(cleanup);

describe("statusDaMeta", () => {
  it("bom na meta, alerta até 3 pontos abaixo, ruim abaixo disso", () => {
    expect(statusDaMeta(0.95, 0.95)).toBe("bom");
    expect(statusDaMeta(0.93, 0.95)).toBe("alerta");
    expect(statusDaMeta(0.9, 0.95)).toBe("ruim");
  });
});

describe("KpiCard", () => {
  it("clicável vira botão com aria-pressed", () => {
    const aoClicar = vi.fn();
    render(
      <KpiCard
        rotulo="SLA"
        valor="95,1%"
        status="bom"
        detalhe="meta 95%"
        aoClicar={aoClicar}
        ativo
      />,
    );
    const botao = screen.getByRole("button", { name: /SLA/ });
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(botao);
    expect(aoClicar).toHaveBeenCalled();
  });
});

describe("mensagens de erro", () => {
  it("mostra só a mensagem da API; erro técnico vira a genérica", () => {
    expect(mensagemAmigavel(new ErroDaApi("CONFLITO", "Já existe.", 409))).toBe("Já existe.");
    expect(mensagemAmigavel(new TypeError("x is undefined"))).toBe(MENSAGEM_ERRO_INTERNO);
  });

  it("MensagemErro com título e tentar de novo", () => {
    const tentar = vi.fn();
    render(
      <MensagemErro
        erro={new ErroDaApi("TEMPO_ESGOTADO", "Reduza o período.", 503)}
        titulo="Não foi possível carregar as coletas"
        aoTentarDeNovo={tentar}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível carregar as coletas: Reduza o período.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(tentar).toHaveBeenCalled();
  });
});

describe("SeloAtualizacao", () => {
  it("horário no fuso de Brasília ou aguardando", () => {
    const { rerender } = render(<SeloAtualizacao atualizadoEm="2026-11-10T13:30:00Z" />);
    expect(screen.getByText("Dados atualizados em 10/11/2026 10:30")).toBeTruthy();
    rerender(<SeloAtualizacao atualizadoEm={null} />);
    expect(screen.getByText("Aguardando a primeira importação")).toBeTruthy();
  });
});
