# De-para `public` → `erp` (para o migrador de dados da onda 2)

Regras gerais (valem para toda tabela, salvo o que a tabela disser):

- **Coluna com o mesmo nome** passa direto. `created_at` → `criado_em`, `updated_at` →
  `atualizado_em`. Tabela sem `criado_em`/`atualizado_em` na origem: preencher com o instante da
  migração (ou o melhor instante da linha, quando houver).
- **`empresa_id`** passa direto. Linha com `empresa_id` nulo em tabela de cliente: não migra e
  entra no relatório do migrador (exceção: `feriados`, onde nulo = nacional).
- **`id` uuid** é preservado: as FKs (`ctrc_id`, `equipe_id`, `unidade_id`, `parceiro_id`,
  `ocorrencia_id`...) continuam válidas sem tradução.
- **Usuários** (`autor`, `atualizado_por`, `registrado_por`...): `auth.users.id` →
  `erp.usuarios.id` pelo mapa da fundação; usuário sem par vira nulo.
- **Dinheiro e peso:** origem `numeric` sem escala → `numeric(14,2)` / `numeric(12,3)`. O migrador
  **falha** (não arredonda) se achar valor com mais casas; relatório com as linhas.
- **Colunas calculadas pelo backend** são copiadas como estão (para o primeiro dia bater com o
  sistema atual) e o migrador roda, no fim, o recálculo do backend em lote para conferir: diferença
  vira relatório, não correção silenciosa.
- **Ordem:** filiais, unidades, parceiros, equipes, códigos → ctes → ocorrências e histórico →
  projeções (reconstruídas, não copiadas) → demais.

## CT-e

### `public.ctrcs` → `erp.ctes`

| Origem                                       | Destino                       | Transformação                                                                                                                                                                         |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                         | `id`                          | igual                                                                                                                                                                                 |
| `numero_ctrc`                                | `numero`                      | parte antes de `/` (CT-e antigo "estacionado" é `'<num>/<sigla>'`); só dígitos, sem zero à esquerda                                                                                   |
| `sigla_ctrc`                                 | `sigla`                       | `upper(btrim())`; se nula: sufixo após `/` em `numero_ctrc`; se ainda nula: sigla do 455 (`staging_455_csv.serie_numero_ctrc`) por número + emissão; sem sigla → não migra, relatório |
| `chave_cte`                                  | `chave`                       | igual                                                                                                                                                                                 |
| `filial`, `unidade_destino`, `unidade_atual` | iguais                        | e `filial_efetiva = coalesce(unidade_destino, unidade_atual, filial)`                                                                                                                 |
| `pagador_cnpj`                               | `pagador_cnpj`                | igual; e `pagador_cnpj_digitos = regexp_replace(pagador_cnpj, '\D', '', 'g')` (nulo se vazio)                                                                                         |
| `ocorr_efetiva_codigo`                       | igual                         | e `ocorr_efetiva_codigo_num = norm_codigo_ocorr(ocorr_efetiva_codigo)`                                                                                                                |
| `valor_mercadoria`, `tde`                    | iguais                        | `numeric` → `numeric(14,2)` (ver regra geral)                                                                                                                                         |
| `prazo_padrao_dias`                          | igual                         | `integer` → `smallint`                                                                                                                                                                |
| `created_at` / `updated_at`                  | `criado_em` / `atualizado_em` | igual                                                                                                                                                                                 |
| demais colunas mantidas                      | mesmo nome                    | igual                                                                                                                                                                                 |

Chave: `ctrcs_numero_ctrc_empresa_key (numero_ctrc, empresa_id)` → `ctes_empresa_sigla_numero_uq
(empresa_id, sigla, numero)`. Conflito na chave nova (dois `ctrcs` com mesma sigla e número):
não deveria existir; se existir, migra o de `atualizado_em` mais novo e reporta o outro.

Fica de fora (sem leitor): `cnpj_transportadora`, `endereco_remetente`, `telefone_remetente`,
`email_remetente`, `cep_remetente`, `cidade_remetente`, `uf_remetente`, `motivo_cancelamento`,
`cancelado_em`, `valor_nf`, `situacao_bi2`, `cte_complementar_de`, `tomador_nome`,
`tomador_cnpj`, `chave_cte_anterior`, `data_entrega_negociada`, `enriquecimento_tentado_em`,
`prazo_ssw_indisponivel`, `romaneio_numero`, `romaneio_situacao`, `ajudante_2_nome`,
`ajudante_3_nome`.

### `public.ctrc_prazo_historico` → `erp.cte_prazo_historico`

`ctrc_id` → `cte_id`; `created_at` → `criado_em`; resto igual. Linha cujo CT-e não migrou: fora.

## Ocorrências e catálogo

### `public.ocorrencias` → `erp.ocorrencias`

| Origem                                                                                                                                    | Destino     | Transformação           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------- |
| `ctrc_id`                                                                                                                                 | `cte_id`    | igual (uuid preservado) |
| `codigo`                                                                                                                                  | `codigo`    | `integer` → `smallint`  |
| `created_at`                                                                                                                              | `criado_em` | igual                   |
| `id`, `descricao`, `complemento`, `data_hora`, `filial`, `protocolo_ssw`, `origem`, `responsavel`, `penaliza`, `quarentena`, `empresa_id` | iguais      | igual                   |

Fica de fora: `payload_bruto`, `latitude`, `longitude`, `nome_recebedor`, `doc_recebedor`,
`quarentena_motivo`. Volume: 1,5 mi — migrar em lotes por `ctrc_id`, com os índices secundários
criados depois da carga.

### `public.codigos_ocorrencia` → `erp.codigos_ocorrencia`

`codigo` `integer` → `smallint`; `updated_at` → `atualizado_em`; `atualizado_por` pelo mapa de
usuários. Fica de fora: `codigo_ssw`, `descricao_ssw`, `paga_comissao_recepcao`,
`paga_agregado_entrega`, `cobrar_reentrega`, `cobrar_estadia`, `informa_cliente`,
`responsabilidade_unidade_origem`, `responsabilidade_unidade_anterior`.

## Filiais, unidades, parceiros, prazos

| Origem                       | Destino                   | Notas                                                          |
| ---------------------------- | ------------------------- | -------------------------------------------------------------- |
| `public.filiais_ssw`         | `erp.filiais`             | igual; `sigla` em `upper(btrim())`                             |
| `public.filial_alias`        | `erp.filiais_apelidos`    | igual                                                          |
| `public.unidades`            | `erp.unidades`            | `created_at` → `criado_em`                                     |
| `public.parceiros`           | `erp.parceiros`           | `created_at` → `criado_em`                                     |
| `public.prazos_configurados` | `erp.prazos_configurados` | `created_*`/`updated_at` renomeados; `created_by` fica de fora |
| `public.prazo_padrao_cidade` | —                         | não migra (obsoleta)                                           |

## Calendário, metas

| Origem             | Destino         | Notas                                            |
| ------------------ | --------------- | ------------------------------------------------ |
| `public.feriados`  | `erp.feriados`  | igual; `empresa_id` nulo = nacional (migra nulo) |
| `public.anotacoes` | `erp.anotacoes` | `autor` → `autor_id` (mapa de usuários)          |
| `public.metas`     | `erp.metas`     | igual                                            |

## Equipes, bonificação

| Origem                          | Destino                           | Notas                                                                                                                                                  |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.equipes_entrega`        | `erp.equipes`                     | `share_token` → `token_publico_hash = encode(sha256(share_token), 'hex')` (o link continua o mesmo); `share_token_revogado` → `token_publico_revogado` |
| `public.membros_equipe`         | `erp.equipe_membros`              | `usuario_id` pelo mapa de usuários; fora: `data_entrada`, `nome_normalizado`                                                                           |
| `public.regras_bonificacao`     | `erp.bonificacao_regras`          | fora: `criada_por`                                                                                                                                     |
| `public.regra_criterios`        | `erp.bonificacao_regra_criterios` | `regra_id` igual                                                                                                                                       |
| `public.bonificacao_parametros` | `erp.bonificacao_parametros`      | igual                                                                                                                                                  |
| `public.bonificacao_faltas`     | `erp.bonificacao_faltas`          | `registrado_em` → `criado_em`                                                                                                                          |
| `public.bonificacao_codigos`    | `erp.bonificacao_codigos`         | `codigo` → `smallint`                                                                                                                                  |
| `public.bonificacao_calculo`    | —                                 | não migra (sem uso; 0 linhas no DEVELOP)                                                                                                               |

## Coletas

`public.coletas` → `erp.coletas`: igual, mais `ctrc_sigla` → `cte_sigla`, `ctrc_numero` →
`cte_numero`, e `etapa` calculada pela regra de `vw_coletas` (CANCEL% → cancelada, COLETAD% →
coletada, COMAND% → comandada, senão cadastrada). `valor_mercadoria` → `numeric(14,2)`,
`peso_kg` → `numeric(12,3)`.

## Projeções (reconstruídas, não copiadas)

O migrador não copia matview. Reconstrói cada projeção com o mesmo código do worker, a partir das
stagings do `public` (que ainda existem na hora da migração), e compara contagens com a matview
atual (ver `REFRESH` antes):

| Destino                    | Fonte                                                                       | Diferença esperada                                                                                          |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `erp.romaneio_viagens_cte` | `public.staging_036_romaneios` (regra de `mv_romaneio_viagem_ctrc`)         | `motorista_norm` → `motorista_normalizado`; `hora_emissao` → `hora_saida`                                   |
| `erp.romaneio_saidas_cte`  | `public.romaneio_saida_ctrc` (cópia direta)                                 | linhas com `sigla_ctrc` nula ficam de fora (relatório)                                                      |
| `erp.romaneio_cte_atual`   | `public.staging_036_romaneios` + `public.staging_306_ssw_mobile`            | chave passa a ter a sigla: a matview atual tem 1 linha por número, a nova pode ter mais (séries diferentes) |
| `erp.cte_dados_relatorios` | `public.staging_038_ctrcs_pendentes` + `public.staging_455_ctrcs_expedidos` | idem (chave com sigla); `prazo_entrega` → `prazo_entrega_038`, `atraso` → `atraso_038`                      |
| `erp.romaneio_conferente_cte` | `public.staging_036_romaneios` (regra de `_ocorrencias_conferente_romaneio`) | chave com sigla; sem matview equivalente (a contagem sai sozinha no relatório) |

## Ingestão

| Origem                                                                                                                                                               | Destino                             | Notas                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.ssw_relatorio_arquivos`                                                                                                                                      | `erp.ingestao_arquivos`             | `tipo_codigo` → `relatorio`; só os últimos 180 dias                                                                                                                                                                                                                                                                                      |
| `public.ssw_ciclo_importacao`                                                                                                                                        | `erp.ingestao_ciclos`               | só os últimos 180 dias                                                                                                                                                                                                                                                                                                                   |
| `public.ssw_relatorio_tipos`                                                                                                                                         | `erp.ingestao_relatorios_esperados` | uma linha por empresa ativa; `codigo` → `relatorio`; fora: `prefixo_arquivo`, `tabela_staging`, `parser_id` (constantes do worker)                                                                                                                                                                                                       |
| `public.ssw_aplicacao_log`                                                                                                                                           | `erp.ingestao_aplicacoes`           | `dry_run` → `simulacao`; `payload` → `detalhe`; fora: `aplicado_em` (igual a `iniciado_em`), `created_at`; só 180 dias                                                                                                                                                                                                                   |
| `public.staging_038_ctrcs_pendentes`, `staging_455_csv`, `staging_930_ocorrencias`, `staging_306_ssw_mobile`, `staging_036_romaneios` | `erp.ingestao_linhas`               | **só as linhas dos últimos 60 dias** (janela de reprocesso), já com `aplicado_em = importado_em`. `relatorio` = código do arquivo; `hash`, `sigla`/`numero` e `data_referencia` pela mesma conta do worker (`identificarLinha` de `@erp/ingestao`); `dados` = colunas tipadas da staging em jsonb; fora: `linha_bruta`, `id` e o espelho `staging_455_ctrcs_expedidos` (Q44) |
| `public.staging_*_erros_parsing` (5)                                                                                                                                 | `erp.ingestao_erros`                | não migra (retenção de 30 dias; recomeça vazia)                                                                                                                                                                                                                                                                                          |
| `public.ssw_aplicacao_fila`, `ssw_fila_controle`, `job_lease`, `ftp_sync_progresso`                                                                                  | —                                   | não migra (estado de job: BullMQ)                                                                                                                                                                                                                                                                                                        |

## XML CT-e, BI2, SSW

| Origem                                | Destino                              | Notas                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.xml_cte_arquivos_processados` | `erp.xml_cte_arquivos`               | `ctrcs_processados` → `ctes_processados`; fora: `enviado_por`; só 180 dias                                                                                                  |
| `public.xml_cte_itens_processados`    | `erp.xml_cte_itens`                  | `numero_ctrc` → `numero_cte`; só 180 dias                                                                                                                                   |
| `public.xml_cte_orfaos`               | `erp.xml_cte_orfaos`                 | `numero_ctrc` → `numero_cte`; só `pendente` e os casados/expirados de 30 dias                                                                                               |
| `public.ftp_xml_sync_log`             | `erp.xml_ftp_sincronizacoes`         | `triggered_by` `cron` → `agendamento`; `ctrcs_processados` → `ctes_processados`; fora: `created_at`; só 90 dias                                                             |
| `public.bi2_raw`                      | `erp.bi2_bruto`                      | `numero_ctrc` → `numero`                                                                                                                                                    |
| `public.bi2_sync_log`                 | `erp.bi2_sincronizacoes`             | só 400 dias                                                                                                                                                                 |
| `public.bi2_viagens`                  | —                                    | não migra (sem leitor)                                                                                                                                                      |
| `public.ssw_webhook_eventos`          | `erp.ssw_webhook_eventos`            | `auth_ok` → `autenticado`; `ctrc_id` → `cte_id`; `status_http` → `smallint`; fora: `created_at`; linhas com `empresa_id` nulo não migram; só 90 dias                        |
| `public.sync_log`                     | `erp.ssw_sincronizacoes`             | `triggered_by` → `disparado_por` (`cron` → `agendamento`); `ctrcs_processados` → `ctes_processados`; fora: `periodo_*`, `ssw_calls`, `ssw_falhas`, `created_at`; só 90 dias |
| `public.sync_state`                   | —                                    | não migra                                                                                                                                                                   |
| `public.ssw_config`                   | `erp.empresa_integracoes` (fundação) | token/usuário/senha/segredo do webhook → segredo cifrado; domínio, CNPJ EDI, CNPJs aceitos e última verificação → `parametros`                                              |
| `public.foto_referencia`              | —                                    | não migra                                                                                                                                                                   |

## Fora do domínio (fundação)

`empresas`, `usuarios_perfil`, `user_roles`, `roles`, `role_screen_permissions`,
`user_screen_permissions`, `departamentos`, `departamento_screen_permissions`, `empresa_usuarios`,
`empresa_modulos`, `empresa_integracoes`, `modulos`, `plataforma_admins`, `configuracoes`,
`auditoria`: de-para da fundação.
