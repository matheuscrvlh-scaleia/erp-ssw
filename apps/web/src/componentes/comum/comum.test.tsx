import { MENSAGEM_ERRO_INTERNO } from "@erp/shared/erros";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErroDaApi } from "@/lib/api";
import { ErroDoOperador, mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { Abas } from "./Abas";
import { ComoFunciona } from "./ComoFunciona";
import { KpiCard } from "./KpiCard";
import { MensagemErro } from "./MensagemErro";
import { SeloAtualizacao } from "./SeloAtualizacao";

afterEach(cleanup);

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

  it("erro do próprio front escrito para o operador aparece; o técnico usa a genérica dada", () => {
    expect(mensagemAmigavel(new ErroDoOperador("Informe o nome da regra."))).toBe(
      "Informe o nome da regra.",
    );
    // Antes as telas mostravam `e.message` cru ("Failed to fetch").
    expect(mensagemAmigavel(new TypeError("Failed to fetch"), "Não foi possível entrar.")).toBe(
      "Não foi possível entrar.",
    );
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

describe("Abas", () => {
  const ABAS = [
    { valor: "parceiro", rotulo: "Parceiro" },
    { valor: "cidade", rotulo: "Cidade" },
  ] as const;

  it("controlada: avisa a aba escolhida e marca a do valor", () => {
    const aoMudar = vi.fn();
    render(<Abas abas={ABAS} valor="cidade" aoMudar={aoMudar} rotulo="Agrupar por" />);
    expect(screen.getByRole("tablist", { name: "Agrupar por" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Cidade" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Parceiro" }));
    expect(aoMudar).toHaveBeenCalledWith("parceiro");
  });
});

describe("ComoFunciona", () => {
  it("abre a explicação e lembra que a pessoa já viu", () => {
    window.localStorage.removeItem("como-funciona:teste");
    render(
      <ComoFunciona chave="teste" titulo="Como funciona o teste" resumo="Resumo da regra.">
        <p>Detalhe da regra.</p>
      </ComoFunciona>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Como funciona: Como funciona o teste" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Detalhe da regra.")).toBeTruthy();
    expect(window.localStorage.getItem("como-funciona:teste")).toBe("1");
  });
});
