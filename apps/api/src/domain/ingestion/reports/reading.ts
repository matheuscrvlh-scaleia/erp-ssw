/**
 * Leitura de um relatório escolhido pela tela (Admin › Importação SSW, prévia no navegador). A
 * detecção pelo nome e pelos bytes é do worker-ssw (ADR 0012).
 */
import { ler036, type Registro036 } from "./r036";
import { ler038, type Registro038 } from "./r038";
import { ler306, type Registro306 } from "./r306";
import { ler455Csv, type Registro455Csv } from "./r455csv";
import { ler930, type Registro930 } from "./r930";
import { type Analise, type Relatorio } from "./types";

/** Linha lida de cada relatório, discriminada pelo código. */
export type AnaliseDoRelatorio =
  | { relatorio: "036"; analise: Analise<Registro036> }
  | { relatorio: "038"; analise: Analise<Registro038> }
  | { relatorio: "306"; analise: Analise<Registro306> }
  | { relatorio: "455csv"; analise: Analise<Registro455Csv> }
  | { relatorio: "930"; analise: Analise<Registro930> };

export function lerRelatorio(relatorio: Relatorio, conteudo: string): AnaliseDoRelatorio {
  switch (relatorio) {
    case "036":
      return { relatorio, analise: ler036(conteudo) };
    case "038":
      return { relatorio, analise: ler038(conteudo) };
    case "306":
      return { relatorio, analise: ler306(conteudo) };
    case "455csv":
      return { relatorio, analise: ler455Csv(conteudo) };
    case "930":
      return { relatorio, analise: ler930(conteudo) };
  }
}
