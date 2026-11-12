import { type FiltroLista } from "@erp/dominio/listagem/filtro";
import { type OpcaoDeCtrc } from "@erp/shared/contratos/ctrc";
import { type TipoDocumentoOpcao } from "@erp/shared/contratos/filtros";
import { type LinhaLista } from "@erp/shared/contratos/listagem";

import {
  type CodigoCadastrado,
  type CtrcGravado,
  type OcorrenciaGravada,
  type RepositorioCtrc,
} from "../models/ctrc/ctrc.service";
import {
  type ContextoDeOpcoes,
  type FiltroDePagadores,
  type PagadorAgrupado,
  type RepositorioFiltros,
} from "../models/filtros/filtros.service";
import {
  type Agregados,
  type ContagemPorCodigo,
  type RepositorioListagem,
} from "../models/listagem/listagem.service";

/*
 * Repositórios falsos das telas de CT-e. Não simulam SQL: devolvem o que o teste preparou e
 * guardam o que receberam (o filtro montado, a página pedida) para o teste conferir.
 */

export class CtrcFalso implements RepositorioCtrc {
  proprias: string[] = ["CAP", "CAS"];
  codigos: CodigoCadastrado[] = [];
  valores = new Map<string, string>();
  ctes: (CtrcGravado & { cidade?: string })[] = [];
  ocorrenciasGravadas: (OcorrenciaGravada & { cteId: string })[] = [];
  romaneios: {
    sigla: string;
    numero: string;
    placa: string;
    motorista: string;
    romaneio: string;
  }[] = [];
  bi2: { numero: string; codigoRelatorio: string; dataAlvo: string; atualizadoEm: Date }[] = [];

  filiaisProprias = () => Promise.resolve([...this.proprias]);
  catalogo = () => Promise.resolve([...this.codigos]);
  configuracoes = (_empresaId: string, chaves: readonly string[]) =>
    Promise.resolve(new Map([...this.valores].filter(([chave]) => chaves.includes(chave))));
  ctesPorNumero = (_empresaId: string, numero: string, sigla: string | null) =>
    Promise.resolve(
      this.ctes
        .filter((c) => c.numero === numero && (sigla === null || c.sigla === sigla))
        .map((c): OpcaoDeCtrc => ({
          sigla: c.sigla,
          numero: c.numero,
          dataEmissao: c.dataEmissao,
          destinatario: c.destinatario,
          cidadeDestino: c.cidadeDestino,
        })),
    );
  ctrc = (_empresaId: string, sigla: string, numero: string) =>
    Promise.resolve(this.ctes.find((c) => c.sigla === sigla && c.numero === numero) ?? null);
  ocorrencias = (cteId: string) =>
    Promise.resolve(this.ocorrenciasGravadas.filter((o) => o.cteId === cteId));
  romaneioAtual = (_empresaId: string, sigla: string, numero: string) =>
    Promise.resolve(this.romaneios.find((r) => r.sigla === sigla && r.numero === numero) ?? null);
  ultimoBi2 = (_empresaId: string, numero: string) =>
    Promise.resolve(this.bi2.find((b) => b.numero === numero) ?? null);
}

export class FiltrosFalso implements RepositorioFiltros {
  siglas: string[] = [];
  filiais: string[] = [];
  valores: string[] = [];
  cidades = new Map<string, string>();
  apelidos = new Map<string, string>();
  agrupados: PagadorAgrupado[] = [];
  tipos: TipoDocumentoOpcao[] = [];
  falharNoPeriodo = false;
  pedidos: { metodo: string; argumentos: unknown[] }[] = [];

  private anotar(metodo: string, ...argumentos: unknown[]) {
    this.pedidos.push({ metodo, argumentos });
  }

  siglasNoPeriodo = (empresaId: string, f: Omit<ContextoDeOpcoes, "siglas">) => {
    this.anotar("siglasNoPeriodo", empresaId, f);
    if (this.falharNoPeriodo) return Promise.reject(new Error("canceling statement"));
    return Promise.resolve([...this.siglas]);
  };
  filiaisDosCtes = () => Promise.resolve([...this.filiais]);
  sugestoes = (
    empresaId: string,
    campo: "remetente" | "cidade_destino",
    contem: string | null,
    f: ContextoDeOpcoes | null,
    limite: number,
  ) => {
    this.anotar("sugestoes", empresaId, campo, contem, f, limite);
    return Promise.resolve([...this.valores]);
  };
  cidadesDasUnidades = (_empresaId: string, ids: readonly string[]) =>
    Promise.resolve(ids.flatMap((id) => this.cidades.get(id) ?? []));
  siglasDasCidades = (_empresaId: string, cidades: readonly string[]) =>
    Promise.resolve(cidades.flatMap((c) => this.apelidos.get(c) ?? []));
  pagadores = (empresaId: string, f: FiltroDePagadores) => {
    this.anotar("pagadores", empresaId, f);
    return Promise.resolve([...this.agrupados]);
  };
  tiposDocumento = () => Promise.resolve([...this.tipos]);
  tiposDocumentoNoPeriodo = () => Promise.resolve([...this.tipos]);
}

export class ListagemFalsa implements RepositorioListagem {
  paginaDeLinhas: LinhaLista[] = [];
  resultadoDosAgregados: Agregados = {
    total: 0,
    porCodigo: [],
    porUnidade: [],
    porCidade: [],
    porAtraso: [],
  };
  contagens: ContagemPorCodigo[] = [];
  filtros: FiltroLista[] = [];
  paginas: { limite: number; deslocamento: number }[] = [];
  pediuAtraso: boolean[] = [];

  linhas = (
    _empresaId: string,
    f: FiltroLista,
    pagina: { limite: number; deslocamento: number },
  ) => {
    this.filtros.push(f);
    this.paginas.push({ limite: pagina.limite, deslocamento: pagina.deslocamento });
    return Promise.resolve(this.paginaDeLinhas.slice(0, pagina.limite));
  };
  agregados = (_empresaId: string, f: FiltroLista, opcoes: { comAtraso: boolean }) => {
    this.filtros.push(f);
    this.pediuAtraso.push(opcoes.comAtraso);
    return Promise.resolve(this.resultadoDosAgregados);
  };
  codigosDoRecorte = (_empresaId: string, f: FiltroLista) => {
    this.filtros.push(f);
    return Promise.resolve([...this.contagens]);
  };
}
