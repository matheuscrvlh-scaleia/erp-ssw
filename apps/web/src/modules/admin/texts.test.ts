import { type CategoriaDeTela } from "@erp/shared/access/permissions";
import { describe, expect, it } from "vitest";

import { avisoDoRecalculo, resumoDoCargo, tomDaSituacao } from "./texts";

const ID = "00000000-0000-4000-8000-000000000001";

describe("textos do admin", () => {
  it("resumo do cargo conta só as telas do editor com Ver; cargo com tudo é Todas", () => {
    expect(resumoDoCargo({ temTudo: true, permissoes: [] })).toBe("Todas");
    const categorias: CategoriaDeTela[] = [
      { chave: "a", rotulo: "A", descricao: "", telas: ["romaneio", "historico"] },
    ];
    expect(
      resumoDoCargo({ temTudo: false, permissoes: ["romaneio.ver", "calendario.ver"] }, categorias),
    ).toBe("1 de 2 telas");
  });

  it("tom da situação pelo texto livre da integração", () => {
    expect(tomDaSituacao("Falhou no FTP")).toBe("erro");
    expect(tomDaSituacao("importado")).toBe("sucesso");
    expect(tomDaSituacao("em andamento")).toBe("neutro");
    expect(tomDaSituacao(null)).toBe("neutro");
  });

  it("aviso do recálculo diz se a fila aceitou", () => {
    expect(avisoDoRecalculo({ id: ID, recalculoAgendado: true })).toBe(
      "A previsão dos CT-e afetados será recalculada em instantes.",
    );
    expect(avisoDoRecalculo({ id: ID, recalculoAgendado: false })).toBe(
      "O recálculo dos CT-e existentes não pôde ser agendado; avise o suporte.",
    );
  });
});
