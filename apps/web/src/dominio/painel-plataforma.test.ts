import { describe, expect, it } from "vitest";

import { type EntradaDaSaude, saudeDaEmpresa, tempoDecorrido } from "./painel-plataforma";

const AGORA = new Date("2026-11-12T15:00:00Z");
const HORA = 3_600_000;
const antes = (ms: number) => new Date(AGORA.getTime() - ms);

const SAUDAVEL: EntradaDaSaude = {
  status: "ativa",
  motivoDaSswApi: "ok",
  workerSsw: "ok",
  jobsComFalha: [],
  ultimoDadoEm: antes(HORA / 2),
  xmlExpirados: 0,
  ultimoLoginEm: antes(HORA),
  semNumeros: false,
  agora: AGORA,
};

const saude = (mudanca: Partial<EntradaDaSaude>) => saudeDaEmpresa({ ...SAUDAVEL, ...mudanca });

describe("saudeDaEmpresa", () => {
  it("tudo em dia é ok, sem motivos", () => {
    expect(saude({})).toEqual({ nivel: "ok", motivos: [] });
  });

  it("dados: mais de 2 h é atenção; mais de um dia ou nenhum é crítico", () => {
    expect(saude({ ultimoDadoEm: antes(3 * HORA) })).toEqual({
      nivel: "atencao",
      motivos: ["Sem dados novos há 3 h"],
    });
    expect(saude({ ultimoDadoEm: antes(30 * HORA) }).nivel).toBe("critico");
    expect(saude({ ultimoDadoEm: null }).motivos).toEqual(["Nenhum dado recebido do SSW"]);
  });

  it("SSW API quebrada é crítica na ativa e atenção em implantação", () => {
    expect(saude({ motivoDaSswApi: "token_expirado" })).toEqual({
      nivel: "critico",
      motivos: ["SSW API com token expirado"],
    });
    expect(saude({ status: "implantacao", motivoDaSswApi: "sem_credenciais" }).nivel).toBe(
      "atencao",
    );
  });

  it("sem o worker-ssw o token é desconhecido: só a falta de credencial conta", () => {
    expect(saude({ workerSsw: "fora", motivoDaSswApi: "sem_token" })).toEqual({
      nivel: "atencao",
      motivos: ["worker-ssw não respondeu"],
    });
    expect(saude({ workerSsw: "fora", motivoDaSswApi: "sem_credenciais" }).nivel).toBe("critico");
  });

  it("job com falha, XML expirado, ninguém entrando e números faltando pedem atenção", () => {
    expect(
      saude({
        workerSsw: "com_falha",
        jobsComFalha: ["bi2-0017", "sincronizar-ftp"],
        xmlExpirados: 2,
        ultimoLoginEm: antes(8 * 24 * HORA),
        semNumeros: true,
      }),
    ).toEqual({
      nivel: "atencao",
      motivos: [
        "Falha recente: bi2-0017, sincronizar-ftp",
        "2 XML expirados",
        "Ninguém entra há 8 dias",
        "Números do mês indisponíveis",
      ],
    });
    expect(saude({ ultimoLoginEm: null }).motivos).toEqual(["Ninguém entrou ainda"]);
    expect(saude({ status: "implantacao", ultimoLoginEm: null }).nivel).toBe("ok");
  });

  it("crítico vem antes da atenção nos motivos", () => {
    expect(saude({ xmlExpirados: 1, motivoDaSswApi: "sem_token" }).motivos).toEqual([
      "SSW API sem token gerado",
      "1 XML expirado",
    ]);
  });

  it("suspensa ou encerrada é inativa, sem olhar o resto", () => {
    expect(saude({ status: "suspensa", ultimoDadoEm: null })).toEqual({
      nivel: "inativa",
      motivos: ["Suspensa"],
    });
  });
});

describe("tempoDecorrido", () => {
  it("horas até 2 dias, depois dias", () => {
    expect(tempoDecorrido(10 * 60_000)).toBe("1 h");
    expect(tempoDecorrido(47 * HORA)).toBe("47 h");
    expect(tempoDecorrido(50 * HORA)).toBe("2 dias");
  });
});
