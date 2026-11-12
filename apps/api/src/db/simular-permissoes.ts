import { readFileSync } from "node:fs";

import { calcularAcesso, type ExcecaoDePermissao, modulosVigentes } from "@erp/dominio/acesso";
import { MODULOS } from "@erp/shared/acesso/modulos";
import { ehAdminDaEmpresa, PAPEL_ADMIN, PAPEL_GESTOR } from "@erp/shared/acesso/papeis";
import { PERMISSOES_GRAVAVEIS } from "@erp/shared/acesso/permissoes";
import { TELAS_ADMIN_PARA_GESTOR, TELAS_SO_PLATAFORMA } from "@erp/shared/acesso/telas";
import { hojeNoFuso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";
import { sql } from "drizzle-orm";

import { comContexto, conectarBanco, type Transacao } from "./cliente";

/*
 * Simulação SOMENTE LEITURA da migração 0014 (acesso → permissões por ação): roda o plano da
 * migração (o SQL entre os marcadores, só SELECT, numa transação READ ONLY) contra o banco real e
 * compara, para cada usuário × empresa, as telas de hoje (regra antiga, reproduzida abaixo) com
 * as telas depois (regra nova de `dominio/acesso.ts` sobre as linhas do plano). Nada é gravado.
 *
 * Uso (em apps/api): node --env-file=<.env com DATABASE_URL> --import tsx src/db/simular-permissoes.ts
 * Apagar junto com as tabelas antigas, depois de a migração rodar.
 */

const MIGRACAO = new URL("../../drizzle/0014_migrar_acesso_para_permissoes.sql", import.meta.url);

/** O plano da migração: os CTE entre `-- plano: início` e `-- plano: fim`. */
function planoDaMigracao(): string {
  const texto = readFileSync(MIGRACAO, "utf8");
  const inicio = texto.indexOf("-- plano: início");
  const fim = texto.indexOf("-- plano: fim");
  if (inicio < 0 || fim < inicio) throw new Error("marcadores do plano não achados na migração");
  return texto.slice(inicio, fim);
}

// ——— Regra de hoje (antes da migração), reproduzida de dominio/acesso.ts (12/11/2026) ———

const OPERACIONAIS = [
  "performance",
  "romaneio",
  "ocorrencias",
  "comprovantes",
  "coletas",
  "prazo_parceiro",
  "historico",
  "calendario",
  "ranking",
  "ranking_novo",
];
const TELAS_DO_SETOR: Record<string, readonly string[]> = {
  diretoria: OPERACIONAIS,
  monitoramento: OPERACIONAIS,
  expedicao: OPERACIONAIS,
  agendamento: [
    "performance",
    "romaneio",
    "ocorrencias",
    "prazo_parceiro",
    "historico",
    "calendario",
  ],
  rh: ["performance", "historico", "calendario"],
};

const TELAS_ADMIN_ANTIGAS = new Set([
  "admin_usuarios",
  "admin_codigos",
  "admin_roles",
  "admin_departamentos",
  "admin_ingestao",
  "admin_importacao_ssw",
  "admin_historico",
  "admin_equipes",
  "admin_bonificacao",
  "admin_configuracoes",
  "admin_xml_cte",
  "admin_ahgora",
  "admin_bonificacao_entrega",
  "admin_logs",
  "admin_ssw_diagnostico",
  "plataforma_empresas",
  "plataforma_logs",
  "plataforma_admins",
  "plataforma_integracoes",
]);

interface EntradaAntiga {
  papel: string | null;
  doCargo: readonly string[];
  doDepartamento: readonly string[];
  setor: string | null;
  excecoes: readonly { tela: string; permitido: boolean }[];
  adminPlataforma: boolean;
  modulos: readonly string[];
}

/** calcularTelas + aplicarTelasDaPlataforma + aplicarModulos de hoje; Departamentos → Cargos. */
function telasDeHoje(e: EntradaAntiga): Set<string> {
  const telas = new Set([...e.doCargo, ...e.doDepartamento]);
  if (telas.size === 0 && e.setor) for (const t of TELAS_DO_SETOR[e.setor] ?? []) telas.add(t);
  for (const { tela, permitido } of e.excecoes) {
    const vale =
      !TELAS_ADMIN_ANTIGAS.has(tela) ||
      ehAdminDaEmpresa(e.papel) ||
      (e.papel === PAPEL_GESTOR && (TELAS_ADMIN_PARA_GESTOR as readonly string[]).includes(tela));
    if (!vale) continue;
    if (permitido) telas.add(tela);
    else telas.delete(tela);
  }
  const daPlataforma = new Set<string>([...TELAS_SO_PLATAFORMA, "admin_logs"]);
  for (const t of [...telas]) if (daPlataforma.has(t)) telas.delete(t);
  if (ehAdminDaEmpresa(e.papel) || e.adminPlataforma) telas.add("admin_logs");
  if (e.adminPlataforma) for (const t of TELAS_SO_PLATAFORMA) telas.add(t);
  if (!e.adminPlataforma) {
    const vale = new Set([...e.modulos, "essencial"]);
    for (const t of [...telas]) {
      const modulos = MODULOS.filter((m) => (m.telas as readonly string[]).includes(t));
      if (modulos.length > 0 && !modulos.some((m) => vale.has(m.chave))) telas.delete(t);
    }
  }
  if (telas.delete("admin_departamentos")) telas.add("admin_roles");
  return telas;
}

// ——— Leitura ———

const texto = z.string();
const uuid = z.string();

async function ler<T>(tx: Transacao, consulta: string, esquema: z.ZodType<T>): Promise<T[]> {
  const resultado = await tx.execute(sql.raw(consulta));
  return z.array(esquema).parse(resultado.rows);
}

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("Defina DATABASE_URL (papel erp_app).");
const conexao = conectarBanco({
  url,
  maxConexoes: 1,
  timeoutConsultaMs: 120_000,
  nomeAplicacao: "erp-simular-permissoes",
});

try {
  const contexto = { empresaId: null, usuarioId: null, plataforma: true };
  const dados = await comContexto(conexao.banco, contexto, async (tx) => {
    await tx.execute(sql`set transaction read only`);
    const plano = planoDaMigracao();
    return {
      acoesDoPlano: await ler(
        tx,
        `WITH ${plano} SELECT tela || '.' || acao AS p FROM acoes`,
        z.object({ p: texto }),
      ),
      planoCargo: await ler(
        tx,
        `WITH ${plano} SELECT empresa_id::text, cargo_chave, tela_chave, acao FROM plano_cargo`,
        z.object({ empresa_id: uuid, cargo_chave: texto, tela_chave: texto, acao: texto }),
      ),
      planoUsuario: await ler(
        tx,
        `WITH ${plano} SELECT empresa_id::text, usuario_id::text, tela_chave, acao, efeito FROM plano_usuario`,
        z.object({
          empresa_id: uuid,
          usuario_id: uuid,
          tela_chave: texto,
          acao: texto,
          efeito: z.enum(["concede", "nega"]),
        }),
      ),
      empresas: await ler(
        tx,
        "SELECT id::text, nome, fuso FROM erp.empresas",
        z.object({ id: uuid, nome: texto, fuso: texto }),
      ),
      usuarios: await ler(
        tx,
        "SELECT id::text, email, ativo FROM erp.usuarios",
        z.object({ id: uuid, email: texto, ativo: z.boolean() }),
      ),
      plataforma: await ler(
        tx,
        "SELECT usuario_id::text FROM erp.plataforma_admins",
        z.object({ usuario_id: uuid }),
      ),
      vinculos: await ler(
        tx,
        "SELECT empresa_id::text, usuario_id::text, papel, departamento_chave, setor, ativo FROM erp.empresa_usuarios",
        z.object({
          empresa_id: uuid,
          usuario_id: uuid,
          papel: texto.nullable(),
          departamento_chave: texto.nullable(),
          setor: texto.nullable(),
          ativo: z.boolean(),
        }),
      ),
      cargoTelas: await ler(
        tx,
        "SELECT empresa_id::text, cargo_chave AS chave, tela_chave AS tela FROM erp.cargo_telas",
        z.object({ empresa_id: uuid, chave: texto, tela: texto }),
      ),
      departamentoTelas: await ler(
        tx,
        "SELECT empresa_id::text, departamento_chave AS chave, tela_chave AS tela FROM erp.departamento_telas",
        z.object({ empresa_id: uuid, chave: texto, tela: texto }),
      ),
      excecoes: await ler(
        tx,
        "SELECT empresa_id::text, usuario_id::text, tela_chave AS tela, permitido FROM erp.usuario_telas",
        z.object({ empresa_id: uuid, usuario_id: uuid, tela: texto, permitido: z.boolean() }),
      ),
      liberacoes: await ler(
        tx,
        "SELECT empresa_id::text, modulo_chave AS modulo, ativo, inicio::text, fim::text FROM erp.empresa_modulos",
        z.object({
          empresa_id: uuid,
          modulo: texto,
          ativo: z.boolean(),
          inicio: texto.nullable(),
          fim: texto.nullable(),
        }),
      ),
    };
  });

  const catalogoDoSql = dados.acoesDoPlano.map((l) => l.p).sort();
  const catalogoDoCodigo = [...PERMISSOES_GRAVAVEIS].sort();
  if (catalogoDoSql.join() !== catalogoDoCodigo.join()) {
    throw new Error("as ações da migração não batem com PERMISSOES_GRAVAVEIS");
  }

  const admins = new Set(dados.plataforma.map((p) => p.usuario_id));
  const agora = new Date();
  const diferencas: string[] = [];
  const esperadas: string[] = [];
  let pares = 0;

  for (const usuario of dados.usuarios) {
    const adminPlataforma = admins.has(usuario.id);
    const vinculos = dados.vinculos.filter((v) => v.usuario_id === usuario.id);
    const empresas = adminPlataforma
      ? dados.empresas
      : dados.empresas.filter((e) => vinculos.some((v) => v.empresa_id === e.id));
    for (const empresa of empresas) {
      pares += 1;
      const vinculo = vinculos.find((v) => v.empresa_id === empresa.id) ?? null;
      const ativo = usuario.ativo && vinculo?.ativo !== false;
      const papel = vinculo?.papel ?? (adminPlataforma ? PAPEL_ADMIN : null);
      const liberacoes = dados.liberacoes.filter((l) => l.empresa_id === empresa.id);
      const modulos = modulosVigentes(MODULOS, liberacoes, hojeNoFuso(empresa.fuso, agora));
      const daEmpresa = (l: { empresa_id: string; chave: string }, chave: string) =>
        l.empresa_id === empresa.id && l.chave === chave;

      const antes = ativo
        ? telasDeHoje({
            papel,
            doCargo: papel
              ? dados.cargoTelas.filter((l) => daEmpresa(l, papel)).map((l) => l.tela)
              : [],
            doDepartamento: vinculo?.departamento_chave
              ? dados.departamentoTelas
                  .filter((l) => daEmpresa(l, vinculo.departamento_chave ?? ""))
                  .map((l) => l.tela)
              : [],
            setor: vinculo?.setor ?? null,
            excecoes: dados.excecoes.filter(
              (l) => l.empresa_id === empresa.id && l.usuario_id === usuario.id,
            ),
            adminPlataforma,
            modulos,
          })
        : new Set<string>();

      const excecoes: ExcecaoDePermissao[] = dados.planoUsuario
        .filter((l) => l.empresa_id === empresa.id && l.usuario_id === usuario.id)
        .map((l) => ({ permissao: `${l.tela_chave}.${l.acao}`, efeito: l.efeito }));
      const depois = new Set<string>(
        calcularAcesso({
          usuarioAtivo: usuario.ativo,
          empresaId: empresa.id,
          adminPlataforma,
          vinculo: vinculo && { papel: vinculo.papel, ativo: vinculo.ativo },
          permissoesDoCargo: dados.planoCargo
            .filter((l) => l.empresa_id === empresa.id && l.cargo_chave === papel)
            .map((l) => `${l.tela_chave}.${l.acao}`),
          excecoes,
          catalogo: MODULOS,
          modulosVigentes: modulos,
        }).telas,
      );

      const ganhou = [...depois].filter((t) => !antes.has(t));
      const perdeu = [...antes].filter((t) => !depois.has(t));
      if (ganhou.length === 0 && perdeu.length === 0) continue;
      const linha = `${usuario.email} @ ${empresa.nome}: ganhou [${ganhou.join(", ")}] perdeu [${perdeu.join(", ")}]`;
      // Admin da Plataforma sem vínculo na empresa entra como Admin, que agora tem tudo.
      if (adminPlataforma && !vinculo && perdeu.length === 0) esperadas.push(linha);
      else diferencas.push(linha);
    }
  }

  const escrever = (texto: string) =>
    process.stdout.write(`${texto}
`);
  const contar = (efeito: string) => dados.planoUsuario.filter((l) => l.efeito === efeito).length;
  escrever(`pares usuário × empresa: ${String(pares)}`);
  escrever(`linhas do plano: cargo_permissoes ${String(dados.planoCargo.length)}`);
  escrever(
    `                 usuario_permissoes ${String(dados.planoUsuario.length)} (Sim ${String(contar("concede"))}, Não ${String(contar("nega"))})`,
  );
  escrever(`diferenças de tela: ${String(diferencas.length)}`);
  for (const d of diferencas) escrever(`  ${d}`);
  escrever(`admin da Plataforma sem vínculo (Admin = tudo): ${String(esperadas.length)}`);
  for (const d of esperadas) escrever(`  ${d}`);
  process.exitCode = diferencas.length === 0 ? 0 : 1;
} finally {
  await conexao.encerrar();
}
