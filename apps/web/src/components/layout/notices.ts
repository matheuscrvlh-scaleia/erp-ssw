import { type Tela } from "@erp/shared/access/screens";
import { type Acesso } from "@erp/shared/contracts/auth";
import { type MotivoDaSaude } from "@erp/shared/contracts/ssw-ingestion";
import { formatarDataHora } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";

import { consultaAtualizacaoDosDados, consultaSaudeSsw } from "@/modules/ssw-ingestion/api";

/** Um aviso do sino: algo que o usuário precisa saber sobre os dados ou a integração. */
export interface Aviso {
  id: string;
  gravidade: "alerta" | "critico";
  titulo: string;
  detalhe: string;
  /** Tela que resolve (só aparece o link se o usuário tiver acesso a ela). */
  link?: { para: string; aba?: string; rotulo: string } | undefined;
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
  // As três telas que resolvem são abas de Administração › Configurações.
  const configuracoes = (tela: Tela, aba: string, rotulo: string) =>
    acesso.telas.includes(tela) ? { para: "/admin/configuracoes", aba, rotulo } : undefined;

  const avisos: Aviso[] = [];
  const s = saude.data;
  if (s && !s.saudavel && s.motivo !== "ok") {
    avisos.push({
      id: "ssw-saude",
      gravidade: "critico",
      titulo: `Integração SSW indisponível — ${DETALHE_DA_SAUDE[s.motivo]}`,
      detalhe: "Os dados exibidos podem estar desatualizados até que a conexão seja restabelecida.",
      link: configuracoes("admin_ingestao", "ingestao", "Abrir configuração"),
    });
  }
  const a = atualizacao.data;
  if (a?.atualizadoEm && Date.now() - Date.parse(a.atualizadoEm) > ATRASO_DOS_DADOS_MS) {
    avisos.push({
      id: "dados-atrasados",
      gravidade: "alerta",
      titulo: "Dados sem atualização recente",
      detalhe: `Última importação do SSW em ${formatarDataHora(a.atualizadoEm, empresa?.fuso)}.`,
      link: configuracoes("admin_importacao_ssw", "importacao-ssw", "Ver importação"),
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
      link: configuracoes("admin_xml_cte", "xml-cte", "Abrir fila"),
    });
  }
  return avisos;
}
