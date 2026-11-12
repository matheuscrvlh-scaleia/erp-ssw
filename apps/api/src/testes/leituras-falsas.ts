import { type RepositorioPerformance } from "../models/performance/performance.service";

/*
 * Repositório de leitura da Performance para os testes: tudo vazio por padrão;
 * cada teste troca só o método que interessa. As consultas reais são SQL; aqui só se testa o
 * caminho HTTP e a orquestração.
 */

export function criarPerformanceFalsa(): RepositorioPerformance {
  return {
    configuracoes: () => Promise.resolve(new Map()),
    filiaisProprias: () => Promise.resolve([]),
    catalogo: () => Promise.resolve([]),
    ampliarTempoLimite: () => Promise.resolve(),
    contagensPorGrupo: () => Promise.resolve([]),
    metasDeRetorno: () => Promise.resolve([]),
    unidadesAtivas: () => Promise.resolve([]),
    cobertura: () => Promise.resolve({ min: null, max: null }),
    pontualidade: () => Promise.resolve([]),
    tdeAguardando: () => Promise.resolve({ aguardando: 0, valor: "0", total: 0 }),
    otif: () => Promise.resolve({ total: 0, problemas: 0 }),
    previstos: () => Promise.resolve([]),
    alertasPorEmissao: () => Promise.resolve([]),
    alertasEmAberto: () => Promise.resolve([]),
    codigosDisponiveis: () => Promise.resolve([]),
    tiposDocumento: () => Promise.resolve([]),
    serie: () => Promise.resolve([]),
    impacto: () => Promise.resolve([]),
    producaoPorUnidade: () => Promise.resolve([]),
    finalizadosPorCodigo: () => Promise.resolve([]),
    ctesParaExportar: () => Promise.resolve([]),
    ocorrenciasDosCtes: () => Promise.resolve([]),
  };
}
