import { type ChavesDeSegredo } from "@erp/db/segredos";

import { type Passo } from "../motor/tipos";
import {
  passoAnotacoes,
  passoCodigosOcorrencia,
  passoFeriados,
  passoFiliais,
  passoFiliaisApelidos,
  passoMetas,
  passoParceiros,
  passoPrazosConfigurados,
  passoUnidades,
} from "./cadastros";
import { passoCtePrazoHistorico, passoCtes } from "./ctes";
import {
  passoBonificacaoCodigos,
  passoBonificacaoFaltas,
  passoBonificacaoParametros,
  passoBonificacaoRegraCriterios,
  passoBonificacaoRegras,
  passoEquipeMembros,
  passoEquipes,
} from "./equipes";
import {
  passoBi2Bruto,
  passoBi2Sincronizacoes,
  passoSswSincronizacoes,
  passoSswWebhookEventos,
  passoXmlCteArquivos,
  passoXmlCteItens,
  passoXmlCteOrfaos,
  passoXmlFtpSincronizacoes,
} from "./externas";
import {
  passoAuditoria,
  passoCargos,
  passoCargoTelas,
  passoConfiguracoes,
  passoDepartamentos,
  passoDepartamentoTelas,
  passoEmpresaIntegracoes,
  passoEmpresaModulos,
  passoEmpresas,
  passoEmpresaUsuarios,
  passoIdentidadesExternas,
  passoPlataformaAdmins,
  passoUsuarios,
  passoUsuarioTelas,
} from "./fundacao";
import {
  passoIngestaoAplicacoes,
  passoIngestaoArquivos,
  passoIngestaoCiclos,
  passoIngestaoRelatoriosEsperados,
  passosDasLinhasDeRelatorio,
} from "./ingestao";
import { passoColetas, passoOcorrencias, passoRomaneioSaidasCte } from "./operacao";

/**
 * Todos os passos, na ordem de dependência: empresas → usuários e acesso → cadastros → CT-e →
 * ocorrências e histórico → operação → ingestão e logs. Uma FK sempre aponta para um passo
 * anterior; as circulares (empresa × usuário, CT-e × CT-e) ficam para o `aposMigrar`.
 */
export function criarPassos(chaves: ChavesDeSegredo): Passo[] {
  return [
    passoEmpresas,
    passoUsuarios,
    passoIdentidadesExternas,
    passoPlataformaAdmins,
    passoCargos,
    passoCargoTelas,
    passoDepartamentos,
    passoDepartamentoTelas,
    passoUnidades,
    passoEmpresaUsuarios,
    passoUsuarioTelas,
    passoEmpresaModulos,
    passoEmpresaIntegracoes(chaves),
    passoConfiguracoes,
    passoAuditoria,
    passoFiliais,
    passoFiliaisApelidos,
    passoParceiros,
    passoPrazosConfigurados,
    passoEquipes,
    passoEquipeMembros,
    passoCodigosOcorrencia,
    passoFeriados,
    passoAnotacoes,
    passoMetas,
    passoBonificacaoRegras,
    passoBonificacaoRegraCriterios,
    passoBonificacaoParametros,
    passoBonificacaoFaltas,
    passoBonificacaoCodigos,
    passoCtes,
    passoCtePrazoHistorico,
    passoOcorrencias,
    passoColetas,
    passoRomaneioSaidasCte,
    passoBi2Bruto,
    passoBi2Sincronizacoes,
    passoIngestaoRelatoriosEsperados,
    passoIngestaoCiclos,
    passoIngestaoArquivos,
    passoIngestaoAplicacoes,
    ...passosDasLinhasDeRelatorio,
    passoXmlCteArquivos,
    passoXmlCteItens,
    passoXmlCteOrfaos,
    passoXmlFtpSincronizacoes,
    passoSswWebhookEventos,
    passoSswSincronizacoes,
  ];
}

/** O que o de-para deixa de fora, para constar em todo relatório. */
export const FORA_DO_ESCOPO: readonly string[] = [
  "Colunas sem leitor de `ctrcs`, `ocorrencias`, `codigos_ocorrencia`, `membros_equipe`, `regras_bonificacao`, `prazos_configurados`, `xml_cte_arquivos_processados`, `sync_log`, `ssw_webhook_eventos` (lista em docs/dados/de-para.md)",
  "`bonificacao_calculo`, `prazo_padrao_cidade`, `bi2_viagens`, `sync_state`, `foto_referencia`: sem uso",
  "`ssw_aplicacao_fila`, `ssw_fila_controle`, `job_lease`, `ftp_sync_progresso`: estado de job (BullMQ)",
  "`staging_*_erros_parsing`: retenção de 30 dias, `ingestao_erros` recomeça vazia",
  "Stagings além de 60 dias, registros técnicos além de 180/90/400 dias (retenção, decisão Q49)",
  "`user_roles` e `usuarios_perfil.departamento_key/unidade_id`: legado (docs/regras/05 §8)",
  "`roles`/`role_screen_permissions` globais: copiados para cada empresa (Q30)",
  "`modulos` e `telas`: catálogo do seed (`bun run --cwd packages/db semear`), não migrado",
  "Segredos nomeados do Vault além do principal (ex.: token de sessão do SSW, que expira em 4 h)",
  "Matviews e views (`mv_*`, `vw_*`, `v_ssw_*`): viram projeções do worker (passo recalcular-projecoes)",
];
