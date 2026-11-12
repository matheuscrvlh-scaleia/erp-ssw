-- Acesso de cargo/departamento/setor/exceção de tela → permissões por ação (cargo + exceção por
-- usuário), preservando o acesso de hoje (decisão do dono): ninguém ganha nem perde tela.
--
-- 1. Cada cargo (menos Admin e Super Admin, que têm tudo pelo código) recebe, em cada tela que
--    tem hoje, "Ver" e as ações que o papel do cargo já fazia nela: todos escrevem anotação no
--    Histórico; o gestor também mexe em Equipes e nas regras de bonificação; o resto da escrita
--    era só de admin (que tem tudo).
-- 2. Cada usuário fica no cargo do seu papel. As telas que ele tinha hoje (cargo ∪ departamento,
--    setor legado quando os dois não davam nada, exceções válidas) e o cargo novo não dá viram
--    "Sim" (concede); o que o cargo novo dá numa tela que ele não tinha vira "Não" (nega).
-- 3. Departamento virou cargo: quem geria Departamentos passa a gerir Cargos (`admin_roles`).
--
-- Catálogo congelado aqui (shared/acesso/{telas,permissoes}.ts e dominio/acesso.ts em
-- 12/11/2026). `src/db/simular-permissoes.ts` roda o plano (entre os marcadores) só com SELECT
-- no banco real e confere tela a tela, para cada usuário × empresa, o antes e o depois.
WITH
-- plano: início
acoes (tela, acao) AS (
  VALUES
    ('performance', 'ver'),
    ('romaneio', 'ver'),
    ('ocorrencias', 'ver'),
    ('comprovantes', 'ver'),
    ('coletas', 'ver'),
    ('coletas', 'editar'),
    ('prazo_parceiro', 'ver'),
    ('historico', 'ver'),
    ('historico', 'editar'),
    ('historico', 'excluir'),
    ('calendario', 'ver'),
    ('calendario', 'editar'),
    ('calendario', 'excluir'),
    ('ranking', 'ver'),
    ('ranking_novo', 'ver'),
    ('admin_usuarios', 'ver'),
    ('admin_usuarios', 'editar'),
    ('admin_codigos', 'ver'),
    ('admin_codigos', 'editar'),
    ('admin_roles', 'ver'),
    ('admin_roles', 'editar'),
    ('admin_roles', 'excluir'),
    ('admin_historico', 'ver'),
    ('admin_historico', 'editar'),
    ('admin_historico', 'excluir'),
    ('admin_equipes', 'ver'),
    ('admin_equipes', 'editar'),
    ('admin_equipes', 'excluir'),
    ('admin_bonificacao', 'ver'),
    ('admin_bonificacao', 'editar'),
    ('admin_bonificacao', 'excluir'),
    ('admin_configuracoes', 'ver'),
    ('admin_configuracoes', 'editar'),
    ('admin_configuracoes', 'excluir'),
    ('admin_bonificacao_entrega', 'ver'),
    ('admin_bonificacao_entrega', 'editar'),
    ('admin_bonificacao_entrega', 'excluir'),
    ('romaneio_placa', 'ver')
),
-- Telas que cargo, departamento e exceção davam (sem as da Plataforma e sem Logs).
gravaveis_antigas (tela) AS (
  VALUES
    ('performance'), ('romaneio'), ('ocorrencias'), ('comprovantes'), ('coletas'),
    ('prazo_parceiro'), ('historico'), ('calendario'), ('ranking'), ('ranking_novo'),
    ('admin_usuarios'), ('admin_codigos'), ('admin_roles'), ('admin_departamentos'),
    ('admin_historico'), ('admin_equipes'), ('admin_bonificacao'), ('admin_configuracoes'),
    ('admin_bonificacao_entrega'), ('romaneio_placa')
),
-- Exceção de tela administrativa só valia para admin (gestor: só Bonificação de entrega).
telas_admin (tela) AS (
  VALUES
    ('admin_usuarios'), ('admin_codigos'), ('admin_roles'), ('admin_departamentos'),
    ('admin_ingestao'), ('admin_importacao_ssw'), ('admin_historico'), ('admin_equipes'),
    ('admin_bonificacao'), ('admin_configuracoes'), ('admin_xml_cte'), ('admin_ahgora'),
    ('admin_bonificacao_entrega'), ('admin_logs'), ('admin_ssw_diagnostico'),
    ('plataforma_empresas'), ('plataforma_logs'), ('plataforma_admins'), ('plataforma_integracoes')
),
-- Fallback do setor legado (só quando cargo e departamento não davam nenhuma tela).
setor_telas (setor, tela) AS (
  SELECT s.setor, t.tela
  FROM (VALUES ('diretoria'), ('monitoramento'), ('expedicao')) AS s (setor)
  CROSS JOIN (
    VALUES
      ('performance'), ('romaneio'), ('ocorrencias'), ('comprovantes'), ('coletas'),
      ('prazo_parceiro'), ('historico'), ('calendario'), ('ranking'), ('ranking_novo')
  ) AS t (tela)
  UNION ALL
  SELECT 'agendamento', t.tela
  FROM (
    VALUES
      ('performance'), ('romaneio'), ('ocorrencias'), ('prazo_parceiro'), ('historico'),
      ('calendario')
  ) AS t (tela)
  UNION ALL
  SELECT 'rh', t.tela FROM (VALUES ('performance'), ('historico'), ('calendario')) AS t (tela)
),
vinculos AS (
  SELECT
    empresa_id,
    usuario_id,
    papel,
    departamento_chave,
    setor,
    coalesce(papel in ('admin', 'super_admin'), false) AS tem_tudo
  FROM erp.empresa_usuarios
),
de_cadastro AS (
  SELECT v.empresa_id, v.usuario_id, ct.tela_chave AS tela
  FROM vinculos v
  JOIN erp.cargo_telas ct ON ct.empresa_id = v.empresa_id AND ct.cargo_chave = v.papel
  UNION
  SELECT v.empresa_id, v.usuario_id, dt.tela_chave
  FROM vinculos v
  JOIN erp.departamento_telas dt
    ON dt.empresa_id = v.empresa_id AND dt.departamento_chave = v.departamento_chave
),
com_setor AS (
  SELECT empresa_id, usuario_id, tela FROM de_cadastro
  UNION
  SELECT v.empresa_id, v.usuario_id, s.tela
  FROM vinculos v
  JOIN setor_telas s ON s.setor = v.setor
  WHERE NOT EXISTS (
    SELECT 1 FROM de_cadastro d WHERE d.empresa_id = v.empresa_id AND d.usuario_id = v.usuario_id
  )
),
excecoes_validas AS (
  SELECT ut.empresa_id, ut.usuario_id, ut.tela_chave AS tela, ut.permitido
  FROM erp.usuario_telas ut
  JOIN vinculos v ON v.empresa_id = ut.empresa_id AND v.usuario_id = ut.usuario_id
  WHERE ut.tela_chave NOT IN (SELECT tela FROM telas_admin)
    OR v.tem_tudo
    OR (v.papel = 'gestor' AND ut.tela_chave = 'admin_bonificacao_entrega')
),
-- Telas de hoje de cada vínculo (Departamentos agora é Cargos).
telas_antes AS (
  SELECT DISTINCT
    t.empresa_id,
    t.usuario_id,
    CASE WHEN t.tela = 'admin_departamentos' THEN 'admin_roles' ELSE t.tela END AS tela
  FROM (
    SELECT c.empresa_id, c.usuario_id, c.tela
    FROM com_setor c
    WHERE NOT EXISTS (
      SELECT 1
      FROM excecoes_validas e
      WHERE e.empresa_id = c.empresa_id
        AND e.usuario_id = c.usuario_id
        AND e.tela = c.tela
        AND NOT e.permitido
    )
    UNION
    SELECT empresa_id, usuario_id, tela FROM excecoes_validas WHERE permitido
  ) AS t
  WHERE t.tela IN (SELECT tela FROM gravaveis_antigas)
),
plano_cargo AS (
  SELECT DISTINCT c.empresa_id, c.chave AS cargo_chave, a.tela AS tela_chave, a.acao
  FROM erp.cargos c
  JOIN erp.cargo_telas ct ON ct.empresa_id = c.empresa_id AND ct.cargo_chave = c.chave
  JOIN acoes a
    ON a.tela = CASE WHEN ct.tela_chave = 'admin_departamentos' THEN 'admin_roles' ELSE ct.tela_chave END
  WHERE c.chave NOT IN ('admin', 'super_admin')
    AND (
      a.acao = 'ver'
      OR a.tela = 'historico'
      OR (c.chave = 'gestor' AND a.tela IN ('admin_equipes', 'admin_bonificacao'))
    )
),
base AS (
  SELECT v.empresa_id, v.usuario_id, a.tela, a.acao
  FROM vinculos v
  CROSS JOIN acoes a
  WHERE v.tem_tudo
  UNION ALL
  SELECT v.empresa_id, v.usuario_id, pc.tela_chave, pc.acao
  FROM vinculos v
  JOIN plano_cargo pc ON pc.empresa_id = v.empresa_id AND pc.cargo_chave = v.papel
  WHERE NOT v.tem_tudo
),
plano_usuario AS (
  -- "Sim": tela de hoje que o cargo não dá, com as ações que o papel fazia nela.
  SELECT t.empresa_id, t.usuario_id, a.tela AS tela_chave, a.acao, 'concede' AS efeito
  FROM telas_antes t
  JOIN vinculos v ON v.empresa_id = t.empresa_id AND v.usuario_id = t.usuario_id
  JOIN acoes a ON a.tela = t.tela
  WHERE NOT EXISTS (
      SELECT 1
      FROM base b
      WHERE b.empresa_id = t.empresa_id
        AND b.usuario_id = t.usuario_id
        AND b.tela = t.tela
        AND b.acao = 'ver'
    )
    AND (
      a.acao = 'ver'
      OR v.tem_tudo
      OR a.tela = 'historico'
      OR (v.papel = 'gestor' AND a.tela IN ('admin_equipes', 'admin_bonificacao'))
    )
  UNION ALL
  -- "Não": o que o cargo dá numa tela que a pessoa não tinha.
  SELECT b.empresa_id, b.usuario_id, b.tela, b.acao, 'nega'
  FROM base b
  WHERE NOT EXISTS (
    SELECT 1
    FROM telas_antes t
    WHERE t.empresa_id = b.empresa_id AND t.usuario_id = b.usuario_id AND t.tela = b.tela
  )
)
-- plano: fim
, gravado_no_cargo AS (
  INSERT INTO "erp"."cargo_permissoes" ("empresa_id", "cargo_chave", "tela_chave", "acao")
  SELECT empresa_id, cargo_chave, tela_chave, acao FROM plano_cargo
  RETURNING 1
)
INSERT INTO "erp"."usuario_permissoes" ("empresa_id", "usuario_id", "tela_chave", "acao", "efeito")
SELECT empresa_id, usuario_id, tela_chave, acao, efeito FROM plano_usuario;
-- Departamentos saiu do catálogo de telas (o vínculo com o módulo Essencial sai junto).
DELETE FROM "erp"."telas" WHERE "chave" = 'admin_departamentos';
