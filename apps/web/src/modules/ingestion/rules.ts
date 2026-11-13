import { type ResultadoDoBlocoDeAplicacao } from "@erp/shared/contracts/ingestion";

/** Próximo disparo do horário de produção (todo minuto, exceto :00 e :30 — Q37). */
export function proximaExecucao(agora: Date): Date {
  const d = new Date(agora);
  d.setSeconds(0, 0);
  do d.setMinutes(d.getMinutes() + 1);
  while (d.getMinutes() === 0 || d.getMinutes() === 30);
  return d;
}

/** Itens guardados de cada lista da aplicação (os totais contam todos). */
const MAX_LISTA = 500;

/** Resultado da aplicação somado bloco a bloco. */
export interface Acumulado {
  dryRun: boolean;
  blocos: number;
  totais: ResultadoDoBlocoDeAplicacao["totais"];
  inserir: ResultadoDoBlocoDeAplicacao["inserir"];
  atualizar: ResultadoDoBlocoDeAplicacao["atualizar"];
  ocorrencias: ResultadoDoBlocoDeAplicacao["ocorrencias"];
  ignorados: ResultadoDoBlocoDeAplicacao["ignorados"];
  romaneio036: number | null;
  pendentes: number;
}

export function somar(a: Acumulado | null, r: ResultadoDoBlocoDeAplicacao): Acumulado {
  const base: Acumulado = a ?? {
    dryRun: r.dryRun,
    blocos: 0,
    totais: { inserir: 0, atualizar: 0, ocorrencias: 0, ignorados: 0 },
    inserir: [],
    atualizar: [],
    ocorrencias: [],
    ignorados: [],
    romaneio036: null,
    pendentes: 0,
  };
  return {
    dryRun: r.dryRun,
    blocos: base.blocos + 1,
    totais: {
      inserir: base.totais.inserir + r.totais.inserir,
      atualizar: base.totais.atualizar + r.totais.atualizar,
      ocorrencias: base.totais.ocorrencias + r.totais.ocorrencias,
      ignorados: base.totais.ignorados + r.totais.ignorados,
    },
    inserir: [...base.inserir, ...r.inserir].slice(0, MAX_LISTA),
    atualizar: [...base.atualizar, ...r.atualizar].slice(0, MAX_LISTA),
    ocorrencias: [...base.ocorrencias, ...r.ocorrencias].slice(0, MAX_LISTA),
    ignorados: [...base.ignorados, ...r.ignorados].slice(0, MAX_LISTA),
    romaneio036: r.romaneio036 ?? base.romaneio036,
    pendentes: r.pendentes,
  };
}
