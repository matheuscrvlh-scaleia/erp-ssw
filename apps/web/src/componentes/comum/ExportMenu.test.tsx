import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErroDaApi } from "@/lib/api";
import { type ColunaExportacao, exportarCsv, exportarExcel } from "@/lib/exportacao";

import { ExportMenu } from "./ExportMenu";
import { ordenarPorPlaca } from "./ordenar-por-placa";

vi.mock("@/lib/exportacao", () => ({
  exportarCsv: vi.fn(),
  exportarExcel: vi.fn(() => Promise.resolve()),
  exportarPdf: vi.fn(() => Promise.resolve()),
  imprimir: vi.fn(() => Promise.resolve()),
}));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const COLUNAS: ColunaExportacao[] = [
  { chave: "ctrc", titulo: "CTRC" },
  { chave: "placa", titulo: "Placa" },
];
const EMPRESA = { nome: "FR Transportes" };

function comConsulta(filho: ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  return <QueryClientProvider client={cliente}>{filho}</QueryClientProvider>;
}

function escolher(formato: RegExp) {
  fireEvent.keyDown(screen.getByRole("button", { name: "Exportar Romaneio" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: formato }));
}

describe("ordenarPorPlaca", () => {
  it("ordena A→Z com as sem placa no fim, estável entre iguais", () => {
    const linhas = [
      { id: 1, placa: "" },
      { id: 2, placa: "BBB1A11" },
      { id: 3, placa: "AAA1A11" },
      { id: 4, placa: "BBB1A11" },
    ];
    expect(ordenarPorPlaca(linhas, COLUNAS).map((l) => l.id)).toEqual([3, 2, 4, 1]);
  });

  it("sem coluna de placa, mantém a ordem", () => {
    const linhas = [{ ctrc: "2" }, { ctrc: "1" }];
    expect(ordenarPorPlaca(linhas, [{ chave: "ctrc", titulo: "CTRC" }])).toBe(linhas);
  });
});

describe("ExportMenu", () => {
  it("sem linhas e sem carregarLinhas, o botão fica desabilitado", () => {
    render(
      comConsulta(
        <ExportMenu
          arquivo="x"
          titulo="Romaneio"
          colunas={COLUNAS}
          linhas={[]}
          empresa={EMPRESA}
        />,
      ),
    );
    expect(screen.getByRole("button", { name: "Exportar Romaneio" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("Excel leva as linhas ordenadas, o total no subtítulo e a empresa", async () => {
    render(
      comConsulta(
        <ExportMenu
          arquivo="romaneio"
          titulo="Romaneio"
          subtitulo="Período: 01/11/2026 a 10/11/2026"
          colunas={COLUNAS}
          linhas={[
            { ctrc: "1", placa: "ZZZ" },
            { ctrc: "2", placa: "AAA" },
          ]}
          empresa={EMPRESA}
        />,
      ),
    );
    escolher(/Excel/);
    await waitFor(() => {
      expect(exportarExcel).toHaveBeenCalledWith({
        arquivo: "romaneio",
        titulo: "Romaneio",
        subtitulo: "Período: 01/11/2026 a 10/11/2026 · 2 registros",
        colunas: COLUNAS,
        linhas: [
          { ctrc: "2", placa: "AAA" },
          { ctrc: "1", placa: "ZZZ" },
        ],
        empresa: EMPRESA,
      });
    });
  });

  it("carregarLinhas vazio: só avisa, não gera arquivo", async () => {
    render(
      comConsulta(
        <ExportMenu
          arquivo="x"
          titulo="Romaneio"
          colunas={COLUNAS}
          linhas={[]}
          carregarLinhas={() => Promise.resolve([])}
          empresa={EMPRESA}
        />,
      ),
    );
    escolher(/CSV/);
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "Nenhum registro no filtro atual — o arquivo não foi gerado.",
      );
    });
    expect(exportarCsv).not.toHaveBeenCalled();
  });

  it("falha na busca mostra a mensagem da API", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const erro = new ErroDaApi("TEMPO_ESGOTADO", "Reduza o período.", 503);
    render(
      comConsulta(
        <ExportMenu
          arquivo="x"
          titulo="Romaneio"
          colunas={COLUNAS}
          linhas={[]}
          carregarLinhas={() => Promise.reject(erro)}
          empresa={EMPRESA}
        />,
      ),
    );
    escolher(/CSV/);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível gerar o arquivo", {
        description: "Reduza o período.",
      });
    });
  });
});
