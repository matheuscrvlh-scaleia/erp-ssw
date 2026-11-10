import { randomUUID } from "node:crypto";

import { etapaDaSituacao, listarColetas, statusDoPrazo } from "@erp/dominio/coletas/coletas";
import {
  classificarComprovantes,
  type CteEntregue,
  listarComprovantes,
} from "@erp/dominio/comprovantes/comprovantes";
import { tipoDocumentoEfetivo } from "@erp/dominio/nucleo";
import { montarLista } from "@erp/dominio/ocorrencias/lista";
import { type LinhaDeOcorrencia } from "@erp/shared/contratos/ocorrencias";

import { type CodigoGravado } from "../modulos/codigos-ocorrencia/casos-de-uso";
import { type ColetaLida } from "../modulos/coletas/casos-de-uso";
import {
  type ComprovanteDaLista,
  type RepositorioComprovantes,
} from "../modulos/comprovantes/casos-de-uso";
import { type AnotacaoGravada, type RepositorioHistorico } from "../modulos/historico/casos-de-uso";
import {
  type CteLido,
  type OcorrenciaLida,
  paraOPainel,
  type RepositorioOcorrencias,
} from "../modulos/ocorrencias/casos-de-uso";
import { type Repositorios } from "../repositorios";
import { type BancoEmMemoria } from "./banco-em-memoria";

/*
 * Dados falsos das telas de Ocorrências, Comprovantes, Coletas, Histórico e Admin › Códigos.
 * Filtram só por empresa e período: o resto da consulta é do banco e não é simulado aqui.
 */

type DaEmpresa<T> = T & { empresaId: string };

/** Campos do CT-e que só a lista detalhada mostra. */
interface DetalheDoCte {
  numeroNf: number | null;
  destinatario: string | null;
  cidadeDestino: string | null;
  ufDestino: string | null;
  peso: number | null;
  volumes: number | null;
  valorFrete: number | null;
  setor: string | null;
}

interface ConferenteDoCte {
  sigla: string;
  numero: string;
  conferente: string | null;
  romaneio: string;
}

export type CteFalso = DaEmpresa<CteLido & DetalheDoCte>;
export type OcorrenciaFalsa = DaEmpresa<
  OcorrenciaLida & { quarentena: boolean; penaliza: boolean; responsavel: string }
>;
export type CodigoFalso = DaEmpresa<CodigoGravado & { pendenciaAcompanhada: boolean }>;
export type AnotacaoFalsa = DaEmpresa<AnotacaoGravada & { criadoEm: Date }>;

type RepositoriosDaOnda = Pick<
  Repositorios,
  "ocorrencias" | "comprovantes" | "coletas" | "historico" | "codigosOcorrencia"
>;

export class DadosDeOcorrencias {
  codigos: CodigoFalso[] = [];
  configuracoes: { empresaId: string; chave: string; valor: string }[] = [];
  ctes: CteFalso[] = [];
  ocorrencias: OcorrenciaFalsa[] = [];
  conferentes: DaEmpresa<ConferenteDoCte>[] = [];
  entregues: DaEmpresa<
    CteEntregue &
      Omit<ComprovanteDaLista, "dataEntrega" | "unidade" | "tipoEfetivo" | "digitalizado">
  >[] = [];
  arquivos930: DaEmpresa<{ nome: string }>[] = [];
  coletas: DaEmpresa<ColetaLida & { relatorioEmitidoEm: Date; historico: unknown }>[] = [];
  anotacoes: AnotacaoFalsa[] = [];

  constructor(private readonly banco: BancoEmMemoria) {}

  repositorios(): RepositoriosDaOnda {
    return {
      ocorrencias: this.ocorrenciasRepo(),
      comprovantes: this.comprovantesRepo(),
      coletas: this.coletasRepo(),
      historico: this.historicoRepo(),
      codigosOcorrencia: this.codigosRepo(),
    };
  }

  private ocorrenciasRepo(): RepositorioOcorrencias {
    const ctesDoFiltro = (f: Parameters<RepositorioOcorrencias["ctes"]>[0]) =>
      this.ctes.filter((c) => {
        const data = f.campoData === "prevista" ? c.dataPrevistaEntrega : c.dataEmissao;
        return (
          c.empresaId === f.empresaId &&
          data !== null &&
          f.periodos.some((p) => data >= p.inicio && data <= p.fim)
        );
      });
    return {
      catalogo: (empresaId) =>
        Promise.resolve(this.codigos.filter((c) => c.empresaId === empresaId)),
      configuracao: (empresaId, chave) =>
        Promise.resolve(
          this.configuracoes.find((c) => c.empresaId === empresaId && c.chave === chave)?.valor ??
            null,
        ),
      ctes: (filtro, limite) => Promise.resolve(ctesDoFiltro(filtro).slice(0, limite)),
      ocorrencias: (filtro, codigos, limite) => {
        const ids = new Set(ctesDoFiltro(filtro).map((c) => c.id));
        return Promise.resolve(
          this.ocorrencias
            .filter((o) => ids.has(o.cteId) && codigos.includes(o.codigo) && !o.quarentena)
            .slice(0, limite),
        );
      },
      // Mesma regra do SQL do repositório, pelo domínio (`montarLista`).
      lista: (filtro, pedido, pagina) => {
        const ctes = new Map(
          paraOPainel(
            ctesDoFiltro(filtro),
            { campoData: filtro.campoData, tipos: pedido.tipos },
            new Set(pedido.baixas),
            pedido.hoje,
          ).map((c) => [c.id, c]),
        );
        const eventos = this.ocorrencias.flatMap((o) => {
          const cte = ctes.get(o.cteId);
          return cte && pedido.codigosTela.includes(o.codigo) && !o.quarentena
            ? [
                {
                  ...o,
                  cte: { ...cte, numero: cte.lido.numero, parceiroNome: cte.lido.parceiroNome },
                },
              ]
            : [];
        });
        const { linhas, total } = montarLista(
          eventos,
          new Map(pedido.catalogo.map((c) => [c.codigo, c])),
          {
            recortes: pedido.recortes,
            ordem: pedido.ordem,
            direcao: pedido.direcao,
            pagina: Math.floor(pagina.deslocamento / pagina.limite) + 1,
            tamanho: pagina.limite,
          },
        );
        return Promise.resolve({
          total,
          linhas: linhas.flatMap((l): LinhaDeOcorrencia[] => {
            const c = this.ctes.find((x) => x.id === l.cte.id);
            if (!c) return [];
            const conf = this.conferentes.find(
              (x) => x.empresaId === c.empresaId && x.sigla === c.sigla && x.numero === c.numero,
            );
            return [
              {
                id: l.id,
                dataHora: l.dataHora.toISOString(),
                codigo: l.codigo,
                descricao: l.classificacao.descricao,
                responsavel: l.classificacao.responsavel,
                penaliza: l.classificacao.penaliza,
                pendente: l.classificacao.pendente,
                cteId: c.id,
                numeroCtrc: c.numero,
                siglaCtrc: c.sigla,
                numeroNf: c.numeroNf,
                dataEmissao: c.dataEmissao,
                unidadeResp: c.filialEfetiva,
                pagador: l.cte.pagador,
                destinatario: c.destinatario,
                cidadeDestino: c.cidadeDestino,
                ufDestino: c.ufDestino,
                peso: c.peso,
                volumes: c.volumes,
                valorFrete: c.valorFrete,
                dataPrevistaEntrega: c.dataPrevistaEntrega,
                setor: c.setor,
                atrasoDias: l.cte.situacao.atrasoDias,
                conferente: conf?.conferente ?? null,
                romaneio: conf?.romaneio ?? null,
              },
            ];
          }),
        });
      },
      conferentes: (empresaId, limite) =>
        Promise.resolve(
          [
            ...new Set(
              this.conferentes
                .filter((c) => c.empresaId === empresaId)
                .flatMap((c) => (c.conferente ? [c.conferente] : [])),
            ),
          ]
            .sort()
            .slice(0, limite),
        ),
      unidadesAtivas: (empresaId) =>
        Promise.resolve(
          this.banco.unidades
            .filter((u) => u.empresaId === empresaId && u.ativo)
            .map(({ id, nome, cidade, uf }) => ({ id, nome, cidade, uf })),
        ),
      pagadores: () => Promise.resolve([]),
    };
  }

  private comprovantesRepo(): RepositorioComprovantes {
    return {
      entregues: (f, limite) =>
        Promise.resolve(
          this.entregues
            .filter((e) => e.empresaId === f.empresaId && e.dia >= f.inicio && e.dia <= f.fim)
            .slice(0, limite),
        ),
      arquivos930Importados: (empresaId) =>
        Promise.resolve(
          this.arquivos930.filter((a) => a.empresaId === empresaId).map((a) => a.nome),
        ),
      // Mesma regra do SQL do repositório, pelo domínio.
      lista: (f, pedido, pagina) => {
        const daEmpresa = this.entregues.filter(
          (e) => e.empresaId === f.empresaId && e.dia >= f.inicio && e.dia <= f.fim,
        );
        const todos = listarComprovantes(
          classificarComprovantes(daEmpresa, new Set(pedido.diasCobertos)),
          pedido.tipos,
          pedido.status,
        );
        const porId = new Map(daEmpresa.map((e) => [e.id, e]));
        const linhas = todos
          .slice(pagina.deslocamento, pagina.deslocamento + pagina.limite)
          .flatMap((c) => {
            const e = porId.get(c.id);
            return e ? [{ ...e, tipoEfetivo: c.tipoEfetivo, digitalizado: c.digitalizado }] : [];
          });
        return Promise.resolve({ total: todos.length, linhas });
      },
    };
  }

  private coletasRepo(): Repositorios["coletas"] {
    const daEmpresa = (empresaId: string) => this.coletas.filter((c) => c.empresaId === empresaId);
    return {
      coletas: (empresaId, f, limite) =>
        Promise.resolve(
          daEmpresa(empresaId)
            .filter((c) => c.diaCadastro >= f.inicio && c.diaCadastro <= f.fim)
            .slice(0, limite),
        ),
      // Mesma regra do SQL do repositório, pelo domínio (a busca já vem em termos).
      lista: (empresaId, f, pedido, pagina) => {
        const daTela = daEmpresa(empresaId)
          .filter((c) => c.diaCadastro >= f.inicio && c.diaCadastro <= f.fim)
          .map((c) => {
            const tipoDaTela =
              c.cteEmissao === null
                ? null
                : tipoDocumentoEfetivo(c.cteTipoDocumento455, c.cteTipoDocumento);
            return {
              ...c,
              statusPrazo: statusDoPrazo(c, pedido.agora, pedido.fuso),
              cteTipoDocumento: tipoDaTela,
              tipoDaTela,
            };
          });
        const { linhas, total } = listarColetas(daTela, {
          status: pedido.status,
          busca: pedido.busca?.texto ?? "",
          pagina: Math.floor(pagina.deslocamento / pagina.limite) + 1,
          tamanho: pagina.limite,
        });
        return Promise.resolve({ total, linhas });
      },
      resumo: (empresaId, inicio, fim) => {
        const todas = daEmpresa(empresaId);
        const dias = todas.map((c) => c.diaCadastro).sort();
        const emissoes = todas.map((c) => c.relatorioEmitidoEm.getTime());
        return Promise.resolve({
          unidades: [...new Set(todas.map((c) => c.unidade))].sort(),
          solicitantes: [
            ...new Set(
              todas
                .filter((c) => c.diaCadastro >= inicio && c.diaCadastro <= fim)
                .flatMap((c) => (c.solicitante ? [c.solicitante] : [])),
            ),
          ].sort(),
          posicaoEm: emissoes.length > 0 ? new Date(Math.max(...emissoes)) : null,
          coberturaInicio: dias[0] ?? null,
          coberturaFim: dias.at(-1) ?? null,
        });
      },
      detalhe: (empresaId, unidade, numero) => {
        const c = daEmpresa(empresaId).find((x) => x.unidade === unidade && x.numero === numero);
        return Promise.resolve(
          c
            ? {
                observacao: c.observacao,
                mercadoria: null,
                setor: null,
                romaneio: null,
                cadastradaPor: null,
                comandadaEm: null,
                limiteInicial: null,
                relatorioEmitidoEm: c.relatorioEmitidoEm,
                historico: c.historico,
              }
            : null,
        );
      },
      jaGravadas: (empresaId, chaves) =>
        Promise.resolve(
          daEmpresa(empresaId)
            .filter((c) => chaves.some((k) => k.unidade === c.unidade && k.numero === c.numero))
            .map((c) => ({ ...c, romaneio: null })),
        ),
      gravar: (empresaId, novas) => {
        const data = (iso: string | null) => (iso ? new Date(iso) : null);
        for (const n of novas) {
          this.coletas = this.coletas.filter(
            (c) => !(c.empresaId === empresaId && c.unidade === n.unidade && c.numero === n.numero),
          );
          this.coletas.push({
            ...n,
            empresaId,
            etapa: etapaDaSituacao(n.situacao),
            situacaoEm: data(n.situacaoEm),
            limiteEm: data(n.limiteEm),
            cadastradaEm: data(n.cadastradaEm),
            diaCadastro: n.diaCadastro ?? "",
            coletadaEm: data(n.coletadaEm),
            canceladaEm: data(n.canceladaEm),
            cteTipoDocumento455: null,
            cteTipoDocumento: null,
            cteEmissao: null,
            ultimoEvento: n.historico[0]?.texto ?? null,
          });
        }
        return Promise.resolve();
      },
    };
  }

  private historicoRepo(): RepositorioHistorico {
    const nomeDoUsuario = (id: string | null) =>
      this.banco.usuarios.find((u) => u.id === id)?.nome ?? null;
    return {
      anotacoes: (empresaId, f, limite) =>
        Promise.resolve(
          this.anotacoes
            .filter(
              (a) =>
                a.empresaId === empresaId &&
                a.data >= f.inicio &&
                a.data <= f.fim &&
                (f.unidades.length === 0 ||
                  (a.unidadeId !== null && f.unidades.includes(a.unidadeId))),
            )
            .sort((a, b) => b.data.localeCompare(a.data))
            .slice(0, limite)
            .map((a) => ({
              id: a.id,
              data: a.data,
              tipo: a.tipo,
              texto: a.texto,
              autorId: a.autorId,
              autorNome: nomeDoUsuario(a.autorId),
              unidadeId: a.unidadeId,
              unidadeNome: this.banco.unidades.find((u) => u.id === a.unidadeId)?.nome ?? null,
              criadoEm: a.criadoEm.toISOString(),
            })),
        ),
      feriados: (empresaId, f, limite) =>
        Promise.resolve(
          this.banco.feriados
            .filter(
              (x) =>
                (x.empresaId === null || x.empresaId === empresaId) &&
                x.data >= f.de &&
                x.data <= f.ate &&
                (!f.tipo || x.tipo === f.tipo) &&
                (!f.uf || x.uf === f.uf),
            )
            .sort((a, b) => b.data.localeCompare(a.data))
            .slice(0, limite),
        ),
      unidadesAtivas: (empresaId) =>
        Promise.resolve(
          this.banco.unidades
            .filter((u) => u.empresaId === empresaId && u.ativo)
            .map(({ id, nome }) => ({ id, nome })),
        ),
      unidadeDaEmpresa: (empresaId, unidadeId) =>
        Promise.resolve(
          this.banco.unidades.some((u) => u.empresaId === empresaId && u.id === unidadeId),
        ),
      autores: (empresaId) =>
        Promise.resolve(
          this.banco.vinculos
            .filter((v) => v.empresaId === empresaId)
            .flatMap((v) => {
              const nome = nomeDoUsuario(v.usuarioId);
              return nome ? [{ id: v.usuarioId, nome }] : [];
            }),
        ),
      anotacao: (empresaId, id) =>
        Promise.resolve(
          this.anotacoes.find((a) => a.empresaId === empresaId && a.id === id) ?? null,
        ),
      criarAnotacao: (nova) => {
        const id = randomUUID();
        this.anotacoes.push({ ...nova, id, criadoEm: new Date() });
        return Promise.resolve(id);
      },
      alterarAnotacao: (id, dados) => {
        const anotacao = this.anotacoes.find((a) => a.id === id);
        if (anotacao) Object.assign(anotacao, dados);
        return Promise.resolve();
      },
      excluirAnotacao: (id) => {
        this.anotacoes = this.anotacoes.filter((a) => a.id !== id);
        return Promise.resolve();
      },
    };
  }

  private codigosRepo(): Repositorios["codigosOcorrencia"] {
    const daEmpresa = (empresaId: string) => this.codigos.filter((c) => c.empresaId === empresaId);
    const doCodigo = (empresaId: string, codigos: number[]) =>
      this.ocorrencias.filter((o) => o.empresaId === empresaId && codigos.includes(o.codigo));
    return {
      listar: (empresaId) =>
        Promise.resolve(daEmpresa(empresaId).sort((a, b) => a.codigo - b.codigo)),
      codigos: (empresaId, codigos) =>
        // Cópias, como o banco devolve: gravar depois não pode mudar o "antes" já lido.
        Promise.resolve(
          daEmpresa(empresaId)
            .filter((c) => codigos.includes(c.codigo))
            .map((c) => ({ ...c })),
        ),
      ocorrenciasPorCodigo: (empresaId, desde) => {
        const contagem = new Map<number, number>();
        for (const o of this.ocorrencias) {
          if (o.empresaId === empresaId && o.dataHora >= desde && !o.quarentena) {
            contagem.set(o.codigo, (contagem.get(o.codigo) ?? 0) + 1);
          }
        }
        return Promise.resolve(contagem);
      },
      contarOcorrencias: (empresaId, codigos) =>
        Promise.resolve(doCodigo(empresaId, codigos).length),
      gravar: (empresaId, codigo, dados, _usuarioId, agora) => {
        const existente = this.codigos.find(
          (c) => c.empresaId === empresaId && c.codigo === codigo,
        );
        if (existente) Object.assign(existente, dados, { atualizadoEm: agora });
        else {
          this.codigos.push({
            ...dados,
            empresaId,
            codigo,
            tipoSsw: null,
            processoSsw: null,
            atualizadoEm: agora,
            atualizadoPorNome: null,
            pendenciaAcompanhada: false,
          });
        }
        return Promise.resolve();
      },
      propagarClassificacao: (empresaId, codigo) => {
        const doCatalogo = daEmpresa(empresaId).find((c) => c.codigo === codigo);
        let regravadas = 0;
        for (const o of doCodigo(empresaId, [codigo])) {
          if (
            doCatalogo &&
            (o.penaliza !== doCatalogo.penaliza || o.responsavel !== doCatalogo.responsavel)
          ) {
            Object.assign(o, {
              penaliza: doCatalogo.penaliza,
              responsavel: doCatalogo.responsavel,
            });
            regravadas += 1;
          }
        }
        return Promise.resolve(regravadas);
      },
      historico: (empresaId, codigo, limite) =>
        Promise.resolve(
          this.banco.auditoria
            .map((a, i) => ({ ...a, id: String(i + 1) }))
            .filter(
              (a) =>
                a.empresaId === empresaId &&
                a.entidade === "codigo_ocorrencia" &&
                a.entidadeId === String(codigo),
            )
            .reverse()
            .slice(0, limite)
            .map((a) => ({
              id: a.id,
              criadoEm: new Date("2026-11-10T12:00:00Z"),
              acao: a.acao,
              antes: a.antes,
              depois: a.depois,
              autorNome: a.ator.email,
            })),
        ),
    };
  }
}
