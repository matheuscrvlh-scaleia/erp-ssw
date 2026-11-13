import {
  type Conexao,
  conexaoMaisRecente,
  situacaoDaIntegracao,
} from "@erp/domain/integration-activity";
import { baseDaSswApi } from "@erp/domain/ingestion/ssw-api";
import { describe, expect, it } from "vitest";

import { parametrosEditados, problemaDoLogo, slugDoNome } from "./rules";

describe("Plataforma › empresas", () => {
  it("slug sugerido pelo nome", () => {
    expect(slugDoNome("  Transportes São João Ltda. ")).toBe("transportes-sao-joao-ltda");
  });

  it("logo: só PNG/JPEG até 512 KB", () => {
    expect(problemaDoLogo({ type: "image/png", size: 1000 })).toBeNull();
    expect(problemaDoLogo({ type: "image/gif", size: 10 })).toBe("Envie o logo em PNG ou JPEG.");
    expect(problemaDoLogo({ type: "image/jpeg", size: 600 * 1024 })).toContain("512 KB");
    expect(problemaDoLogo({ type: "image/gif", size: 10 }, "favicon")).toBe(
      "Envie o favicon em PNG ou JPEG.",
    );
  });

  it("parâmetros: troca os editados, lista por vírgula, apaga o vazio e mantém os desconhecidos", () => {
    expect(
      parametrosEditados(
        { host: "velho", origem: "env", porta: "22" },
        [{ chave: "host" }, { chave: "porta" }, { chave: "cnpjs", lista: true }],
        { host: " ftp.fr ", porta: "", cnpjs: "1, 2,,3" },
      ),
    ).toEqual({ host: "ftp.fr", origem: "env", cnpjs: ["1", "2", "3"] });
  });
});

describe("Plataforma › situação da integração", () => {
  const agora = new Date("2026-11-13T12:00:00Z");
  const h = (horas: number) => new Date(agora.getTime() - horas * 3_600_000);
  const ok = (horas: number): Conexao => ({ em: h(horas), ok: true, mensagem: null });
  const falha = (horas: number): Conexao => ({ em: h(horas), ok: false, mensagem: "timeout" });
  const situacao = (ultimaConexao: Conexao | null, ultimoDadoEm: Date | null, ativo = true) =>
    situacaoDaIntegracao({ ativo, ultimaConexao, ultimoDadoEm, agora });

  it("desligada vence tudo", () => {
    expect(situacao(ok(1), h(1), false)).toBe("desligada");
  });

  it("ativa com conexão ok ou dado nas últimas 24 h", () => {
    expect(situacao(ok(2), null)).toBe("ativa");
    expect(situacao(null, h(23))).toBe("ativa");
  });

  it("com falha quando a última conexão falhou e nenhum dado veio depois", () => {
    expect(situacao(falha(1), h(5))).toBe("com_falha");
    expect(situacao(falha(5), h(1))).toBe("ativa");
  });

  it("sem sinal quando nada é recente ou nada foi registrado", () => {
    expect(situacao(ok(30), h(30))).toBe("sem_sinal");
    expect(situacao(null, null)).toBe("sem_sinal");
  });

  it("a conexão mais recente entre o job e o teste", () => {
    expect(conexaoMaisRecente(ok(5), falha(1), null)?.ok).toBe(false);
    expect(conexaoMaisRecente(null, null)).toBeNull();
  });
});

describe("Plataforma › endereço da SSW API", () => {
  it("vazio usa o padrão; só o servidor ganha https e /api; barra final sai", () => {
    expect(baseDaSswApi("  ")).toBe("https://ssw.inf.br/api");
    expect(baseDaSswApi("tms.ssw.inf.br")).toBe("https://tms.ssw.inf.br/api");
    expect(baseDaSswApi("https://tms.ssw.inf.br/api/")).toBe("https://tms.ssw.inf.br/api");
    expect(baseDaSswApi("http://10.0.0.1:8080/v2")).toBe("http://10.0.0.1:8080/v2");
  });

  it("recusa outro protocolo, consulta na URL e texto que não é endereço", () => {
    expect(baseDaSswApi("ftp://ssw.inf.br")).toBeNull();
    expect(baseDaSswApi("https://ssw.inf.br/api?x=1")).toBeNull();
    expect(baseDaSswApi("ssw")).toBeNull();
    expect(baseDaSswApi("ssw inf br")).toBeNull();
  });
});
