/**
 * Catálogos da Plataforma usados pela API (validação) e pela tela (rótulos): status de empresa,
 * integrações e o que cada uma guarda.
 * origem: src/features/plataforma/types.ts (sistema atual)
 */
export const STATUS_EMPRESA = ["implantacao", "ativa", "suspensa", "encerrada"] as const;
export type StatusEmpresa = (typeof STATUS_EMPRESA)[number];

export const ROTULO_DO_STATUS: Record<StatusEmpresa, string> = {
  implantacao: "Em implantação",
  ativa: "Ativa",
  suspensa: "Suspensa",
  encerrada: "Encerrada",
};

export const TIPOS_INTEGRACAO = [
  "sftp",
  "ssw_api",
  "ssw_bi2",
  "ssw_webhook",
  "ssw_web",
  "ahgora",
  "xml_cte",
  "ingestao_publica",
] as const;
export type TipoIntegracao = (typeof TIPOS_INTEGRACAO)[number];

/**
 * Se a integração está funcionando: desligada; ativa (conectou ou trouxe dado nas últimas 24 h);
 * com falha (a última conexão falhou); sem sinal (ligada, mas nada recente).
 */
export const SITUACOES_DA_INTEGRACAO = ["desligada", "ativa", "com_falha", "sem_sinal"] as const;
export type SituacaoDaIntegracao = (typeof SITUACOES_DA_INTEGRACAO)[number];

export const ROTULO_DA_SITUACAO_DA_INTEGRACAO: Record<SituacaoDaIntegracao, string> = {
  desligada: "Desligada",
  ativa: "Ativa",
  com_falha: "Com falha",
  sem_sinal: "Sem sinal",
};

/** Integrações que a Plataforma configura na empresa (Plataforma › Empresas › Integrações). */
export const TIPOS_INTEGRACAO_DA_EMPRESA = [
  "ssw_web",
  "ssw_bi2",
] as const satisfies readonly TipoIntegracao[];
export type TipoIntegracaoDaEmpresa = (typeof TIPOS_INTEGRACAO_DA_EMPRESA)[number];

/** Nome de cada integração (painel da Plataforma). */
export const NOME_DA_INTEGRACAO: Record<TipoIntegracao, string> = {
  sftp: "SFTP (relatórios do SSW)",
  ssw_api: "SSW API",
  ssw_bi2: "SSW BI2",
  ssw_webhook: "Webhook SSW",
  ssw_web: "Worker SSW",
  ahgora: "Ahgora (ponto)",
  xml_cte: "XML CT-e",
  ingestao_publica: "Rotas públicas da ingestão",
};

interface InfoDaIntegracao {
  nome: string;
  descricao: string;
  campos: readonly { chave: string; rotulo: string; lista?: boolean; dica?: string }[];
  /** Rótulo do segredo (senha/token); sem ele a integração não tem segredo próprio. */
  segredo?: string;
  /** Rótulo do último dado que ela traz. */
  ultimoDado?: string;
}

export const INFO_DA_INTEGRACAO: Record<TipoIntegracaoDaEmpresa, InfoDaIntegracao> = {
  ssw_web: {
    nome: NOME_DA_INTEGRACAO.ssw_web,
    descricao:
      "Entra no SSW com este usuário a cada 30 min, baixa os relatórios 036, 038, 050, 306, 455 e 930 e grava direto no sistema. Usa o domínio SSW acima.",
    campos: [
      { chave: "usuario", rotulo: "Usuário do SSW" },
      { chave: "cpf", rotulo: "CPF do usuário", dica: "Só os números" },
      {
        chave: "unidades_038",
        rotulo: "Unidades (pendentes, 038)",
        lista: true,
        dica: "Siglas separadas por vírgula. Ex.: ARA, CAP, RIO",
      },
      {
        chave: "unidades_050",
        rotulo: "Unidades das coletas (050)",
        lista: true,
        dica: "Vazio = sem coletas",
      },
    ],
    segredo: "Senha do SSW",
    ultimoDado: "Último relatório recebido",
  },
  ssw_bi2: {
    nome: NOME_DA_INTEGRACAO.ssw_bi2,
    descricao: "API CSV do BI2 (CT-e, 0013, 0017, 0174, 0220).",
    campos: [{ chave: "dominio", rotulo: "Domínio", dica: "Ex.: FRT" }],
    segredo: "Token do BI2",
    ultimoDado: "Última sincronização",
  },
};

/**
 * Integrações da própria Plataforma (valem para todas as empresas): o que antes ficava no .env da
 * VPS. O segredo de cada uma vai cifrado com a chave mestra (`SEGREDOS_CHAVES`), que fica no .env.
 */
export const TIPOS_INTEGRACAO_PLATAFORMA = ["dominio", "email", "worker_ssw"] as const;
export type TipoIntegracaoPlataforma = (typeof TIPOS_INTEGRACAO_PLATAFORMA)[number];

export const INFO_DA_INTEGRACAO_PLATAFORMA: Record<TipoIntegracaoPlataforma, InfoDaIntegracao> = {
  dominio: {
    nome: "Domínio do sistema",
    descricao: "Endereço público do ERP: monta os links do convite e do “esqueci minha senha”.",
    campos: [{ chave: "url", rotulo: "Endereço", dica: "Ex.: https://erp.suaempresa.com.br" }],
  },
  email: {
    nome: "E-mail (Resend)",
    descricao: "Envio do convite e do “esqueci minha senha” pelo Resend.",
    campos: [
      {
        chave: "remetente",
        rotulo: "Remetente",
        dica: "Ex.: Painel Logístico <nao-responda@suaempresa.com.br> (domínio verificado no Resend)",
      },
    ],
    segredo: "Chave da API do Resend",
  },
  worker_ssw: {
    nome: "worker-ssw",
    descricao:
      "Endereço do worker-ssw e o token de serviço. Sem eles, as ações das telas de ingestão ficam indisponíveis.",
    campos: [{ chave: "url", rotulo: "Endereço", dica: "Ex.: https://worker.ssw.scaleia.ai" }],
    segredo: "Token de serviço",
  },
};

/** Nome de parâmetro que parece segredo: nunca vai em `parametros` (vai cifrado à parte). */
export const CHAVE_COM_CARA_DE_SEGREDO = /(senha|token|secret|segredo|apikey|api_key|password)/i;

/** Logo da empresa: até 512 KB, PNG ou JPEG. */
export const LOGO_MAXIMO_BYTES = 512 * 1024;
