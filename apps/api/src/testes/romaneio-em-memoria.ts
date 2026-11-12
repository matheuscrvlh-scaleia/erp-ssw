import { type Linha036 } from "@erp/dominio/romaneio/hoje";
import { type Linha930, type OcorrenciaGravada } from "@erp/dominio/romaneio/linha-do-tempo";
import { type CodigoCadastrado } from "@erp/dominio/romaneio/situacao";
import { type MotoristaDeEquipe, type Viagem } from "@erp/dominio/romaneio/viagens";

import {
  type ConsultaDeCtes,
  type CteDoDiaGravado,
  type DetalheDaLinha,
  type FatoDaLista,
  type RepositorioRomaneio,
} from "../models/romaneio/romaneio.service";

/*
 * Romaneio falso: devolve o que o teste gravou. Não simula os filtros SQL (só `ids`); guarda as
 * consultas recebidas para o teste conferir o que o caso de uso pediu.
 */
export class RomaneioEmMemoria {
  filiais: { sigla: string; nome: string }[] = [{ sigla: "SPO", nome: "São Paulo" }];
  codigos: CodigoCadastrado[] = [];
  configuracoes = new Map<string, string>();
  ctes: FatoDaLista[] = [];
  detalhes: DetalheDaLinha[] = [];
  viagens = new Map<string, Viagem[]>();
  motoristas: MotoristaDeEquipe[] = [];
  linhas036: Linha036[] = [];
  ctesDoDia: CteDoDiaGravado[] = [];
  ocorrencias: OcorrenciaGravada[] = [];
  linhas930: Linha930[] = [];
  consultas: ConsultaDeCtes[] = [];

  repositorio(): RepositorioRomaneio {
    return {
      filiaisProprias: () => Promise.resolve(this.filiais),
      codigos: () => Promise.resolve(this.codigos),
      configuracoes: (chaves) =>
        Promise.resolve(new Map([...this.configuracoes].filter(([k]) => chaves.includes(k)))),
      ctes: (consulta) => {
        this.consultas.push(consulta);
        const { ids } = consulta;
        return Promise.resolve(ids ? this.ctes.filter((c) => ids.includes(c.id)) : this.ctes);
      },
      detalhes: (ids) => Promise.resolve(this.detalhes.filter((d) => ids.includes(d.id))),
      viagens: (ids) =>
        Promise.resolve(new Map([...this.viagens].filter(([id]) => ids.includes(id)))),
      motoristasDeEquipe: () => Promise.resolve(this.motoristas),
      opcoesPlacaMotorista: () => {
        const todas = [...this.viagens.values()].flat();
        const unicos = (v: (string | null)[]) => [...new Set(v.filter((x) => x !== null))].sort();
        return Promise.resolve({
          placas: unicos(todas.map((v) => v.placa)),
          motoristas: unicos(todas.map((v) => v.motoristaNormalizado)),
        });
      },
      pagadoresETipos: () => Promise.resolve({ pagadores: [], tipos: [] }),
      linhas036DoDia: (dia) => Promise.resolve(this.linhas036.filter((l) => l.dataEmissao === dia)),
      ctesDoDia: (numeros) =>
        Promise.resolve(this.ctesDoDia.filter((c) => numeros.includes(c.numero))),
      linhaDoTempo: () =>
        Promise.resolve({ ocorrencias: this.ocorrencias, linhas930: this.linhas930 }),
    };
  }
}
