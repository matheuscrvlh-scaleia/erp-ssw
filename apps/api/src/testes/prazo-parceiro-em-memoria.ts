import { nasceuAtrasado } from "@erp/dominio/prazo-parceiro/prazo-parceiro";

import {
  type CadastroDeParceiro,
  type ConsultaPrazo,
  type FatoDoPrazo,
  type RepositorioPrazoParceiro,
} from "../modulos/prazo-parceiro/casos-de-uso";

/*
 * Prazo do parceiro falso: filtra por período e pelo recorte do detalhe/lista como o SQL faria
 * (sem universo de filiais nem tipos); guarda as consultas recebidas.
 */
export class PrazoParceiroEmMemoria {
  filiais = ["SPO"];
  configuracoes = new Map<string, string>();
  cadastros: CadastroDeParceiro[] = [];
  unidades: { id: string; nome: string }[] = [];
  tipos: string[] = [];
  ctes: FatoDoPrazo[] = [];
  consultas: ConsultaPrazo[] = [];

  private filtrar(c: ConsultaPrazo): FatoDoPrazo[] {
    this.consultas.push(c);
    return this.ctes.filter(
      (x) =>
        x.dataEmissao >= c.periodo.inicio &&
        x.dataEmissao <= c.periodo.fim &&
        (!c.doParceiro ||
          (x.parceiroId !== null && c.doParceiro.ids.includes(x.parceiroId)) ||
          (c.doParceiro.cnpj !== null && x.parceiroCnpj === c.doParceiro.cnpj)),
    );
  }

  repositorio(): RepositorioPrazoParceiro {
    const daLista = (c: ConsultaPrazo, filtro: string) =>
      this.filtrar(c)
        .filter(
          (x) =>
            filtro === "todos" ||
            (filtro === "nascidos" ? nasceuAtrasado(x) : x.prazoOrigem === "parceiro"),
        )
        .sort(
          (a, b) =>
            (b.dataEmbarque ?? "").localeCompare(a.dataEmbarque ?? "") || b.id.localeCompare(a.id),
        );
    return {
      filiaisProprias: () => Promise.resolve(this.filiais),
      configuracoes: (chaves) =>
        Promise.resolve(new Map([...this.configuracoes].filter(([k]) => chaves.includes(k)))),
      parceiros: () => Promise.resolve(this.cadastros),
      unidadesAtivas: () => Promise.resolve(this.unidades),
      tiposDeDocumento: () => Promise.resolve(this.tipos),
      fatos: (c) => Promise.resolve(this.filtrar(c)),
      lista: (c, filtro, p) =>
        Promise.resolve(daLista(c, filtro).slice(p.inicio, p.inicio + p.quantos)),
      contarLista: (c, filtro) => Promise.resolve(daLista(c, filtro).length),
    };
  }
}
