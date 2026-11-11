import { CAMINHO_DA_TELA } from "@erp/shared/acesso/telas";
import { type Acesso } from "@erp/shared/contratos/auth";
import { type MotivoDaSaude } from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";

import { consultaAtualizacaoDosDados, consultaSaudeSsw } from "@/modulos/ingestao-ssw/api";

/** Um aviso do sino: algo que o usuário precisa saber sobre os dados ou a integração. */
export interface Aviso {
  id: string;
  gravidade: "alerta" | "critico";
  titulo: string;
  detalhe: string;
  /** Tela que resolve (só aparece o link se o usuário tiver acesso a ela). */
  link?: { para: string; rotulo: string } | undefined;
}

const DETALHE_DA_SAUDE: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "credenciais não configuradas",
  sem_token: "nenhum token gerado ainda",
  token_expirado: "token expirado",
};

/** O ciclo dos arquivos do SSW roda de 30 em 30 min: 2 h sem aplicar já é atraso visível. */
const ATRASO_DOS_DADOS_MS = 2 * 60 * 60 * 1000;

const inteiro = new Intl.NumberFormat("pt-BR");

/**
 * Avisos montados a partir das consultas que o layout já faz (saúde da SSW API e horário da
 * última importação). Mesmas chaves de cache da faixa e do selo: nenhuma chamada a mais.
 */
export function useAvisos(acesso: Acesso): Aviso[] {
  const empresa = acesso.empresa;
  const saude = useQuery({ ...consultaSaudeSsw(empresa?.id ?? ""), enabled: empresa !== null });
  const atualizacao = useQuery({
    ...consultaAtualizacaoDosDados(empresa?.id ?? ""),
    enabled: empresa !== null,
  });
  const pode = (caminho: string) => acesso.telas.some((t) => CAMINHO_DA_TELA[t] === caminho);

  const avisos: Aviso[] = [];
  const s = saude.data;
  if (s && !s.saudavel && s.motivo !== "ok") {
    avisos.push({
      id: "ssw-saude",
      gravidade: "critico",
      titulo: `Integração SSW indisponível — ${DETALHE_DA_SAUDE[s.motivo]}`,
      detalhe: "Os dados exibidos podem estar desatualizados até que a conexão seja restabelecida.",
      link: pode("/admin/ingestao")
        ? { para: "/admin/ingestao", rotulo: "Abrir configuração" }
        : undefined,
    });
  }
  const a = atualizacao.data;
  if (a?.atualizadoEm && Date.now() - Date.parse(a.atualizadoEm) > ATRASO_DOS_DADOS_MS) {
    avisos.push({
      id: "dados-atrasados",
      gravidade: "alerta",
      titulo: "Dados sem atualização recente",
      detalhe: `Última importação do SSW em ${formatarDataHora(a.atualizadoEm, empresa?.fuso)}.`,
      link: pode("/admin/importacao-ssw")
        ? { para: "/admin/importacao-ssw", rotulo: "Ver importação" }
        : undefined,
    });
  }
  if (a?.xmlAguardando && a.xmlAguardando.pendentes > 0) {
    const { pendentes, expirados } = a.xmlAguardando;
    avisos.push({
      id: "xml-aguardando",
      gravidade: "alerta",
      titulo: `${inteiro.format(pendentes)} XML de CT-e aguardando`,
      detalhe:
        "Recebidos por FTP e ainda sem o documento no BI2. A fila é reprocessada sozinha e expira em 5 dias." +
        (expirados > 0 ? ` ${inteiro.format(expirados)} já expiraram sem casar.` : ""),
      link: pode("/admin/xml-cte") ? { para: "/admin/xml-cte", rotulo: "Abrir fila" } : undefined,
    });
  }
  return avisos;
}
