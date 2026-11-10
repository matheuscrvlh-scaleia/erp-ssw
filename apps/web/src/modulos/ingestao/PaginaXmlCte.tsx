/**
 * Admin › XML CT-e (só Plataforma): sincronização automática do FTP (relatórios SSW) e upload
 * manual de XML de CT-e (Q43: a chave da NF-e passa a ser gravada).
 */
import { contratosIngestao as c, type ResultadoDoXml } from "@erp/shared/contratos/ingestao";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, RefreshCw, Unlock, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Switch } from "@/componentes/ui/switch";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaArquivosXml, consultaFtp } from "./api";
import { BarraDeProgresso, Cartao, SeloStatus } from "./pecas";

const MAX_ARQUIVOS = 50;

/** Próximo disparo do horário de produção (todo minuto, exceto :00 e :30 — Q37). */
export function proximaExecucao(agora: Date): Date {
  const d = new Date(agora);
  d.setSeconds(0, 0);
  do d.setMinutes(d.getMinutes() + 1);
  while (d.getMinutes() === 0 || d.getMinutes() === 30);
  return d;
}

const dataHora = (iso: string | null | undefined) => (iso ? formatarDataHora(iso) : "—");

function CartaoFtp() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaFtp);
  const [agindo, setAgindo] = useState(false);
  const dados = consulta.data;
  const ultima = dados?.historico[0];
  const p = dados?.progresso;
  const rodando = dados?.travaAtiva ?? false;

  const agir = async (acao: () => Promise<unknown>, sucesso: string) => {
    setAgindo(true);
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
    } finally {
      setAgindo(false);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  return (
    <Cartao
      titulo="Sincronização automática FTP"
      descricao={
        dados ? `Horário: ${dados.agenda}` : "Relatórios do SSW depositados no SFTP da empresa."
      }
      acoes={
        <>
          <label className="flex items-center gap-2 text-[12px]">
            <Switch
              checked={dados?.ativo ?? true}
              disabled={!dados || agindo}
              onCheckedChange={(ativo) =>
                void agir(
                  () => chamar(c.pausarFtp, { entrada: { ativo } }),
                  ativo ? "Sincronização retomada" : "Sincronização pausada",
                )
              }
            />
            {dados?.ativo === false ? "Pausada" : "Ativa"}
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void consulta.refetch()}
            disabled={consulta.isFetching}
          >
            <RefreshCw className="mr-1 h-4 w-4" aria-hidden /> Atualizar
          </Button>
          <Button
            size="sm"
            disabled={agindo || rodando}
            onClick={() =>
              void agir(
                () => chamar(c.rodarFtp),
                "Sincronização iniciada. Acompanhe o andamento abaixo.",
              )
            }
          >
            <Play className="mr-1 h-4 w-4" aria-hidden /> Rodar agora
          </Button>
        </>
      }
    >
      {rodando && p && (
        <div className="space-y-2 rounded-md border p-3 text-[12px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {p.fase === "conectando"
                ? "Conectando ao SFTP…"
                : `Arquivo ${p.arquivoAtualIndice} de ${p.totalArquivos}`}
              {p.arquivoAtualNome && <span className="font-mono">{p.arquivoAtualNome}</span>}
              {p.mensagem && <span className="text-muted-foreground">· {p.mensagem}</span>}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px]"
              disabled={agindo}
              onClick={() => {
                if (
                  window.confirm(
                    "Liberar a trava? Use só se a sincronização travou (sem andamento há minutos).",
                  )
                )
                  void agir(() => chamar(c.liberarTravaFtp), "Trava liberada");
              }}
            >
              <Unlock className="mr-1 h-4 w-4" aria-hidden /> Liberar trava
            </Button>
          </div>
          <BarraDeProgresso
            valor={p.totalArquivos > 0 ? p.arquivoAtualIndice / p.totalArquivos : 0}
            rotulo="Andamento da sincronização"
          />
          <p className="text-muted-foreground">Último sinal: {dataHora(p.heartbeatEm)}</p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Última execução</dt>
          <dd className="flex items-center gap-2">
            {dataHora(ultima?.executadoEm)} {ultima && <SeloStatus status={ultima.status} />}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Processados</dt>
          <dd>{ultima?.arquivosProcessados ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Com erro</dt>
          <dd>{ultima?.arquivosComErro ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Próxima execução</dt>
          <dd>
            {dados?.ativo === false
              ? "Pausada"
              : formatarDataHora(proximaExecucao(new Date()).toISOString())}
          </dd>
        </div>
      </dl>
      {ultima?.mensagem && <p className="text-[12px]">{ultima.mensagem}</p>}
      {ultima && ultima.erros.length > 0 && (
        <details className="rounded-md border p-2 text-[12px]">
          <summary className="cursor-pointer">Ver erros ({ultima.erros.length})</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono">
            {ultima.erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </Cartao>
  );
}

async function emBase64(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

function UploadXml() {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoDoXml[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const enviar = async (lista: File[]) => {
    const validos = lista.filter((f) => /\.(xml|zip)$/i.test(f.name));
    if (validos.length === 0) {
      toast.error("Envie arquivos .xml ou .zip.");
      return;
    }
    if (validos.length > MAX_ARQUIVOS) {
      toast.error(`Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`);
      return;
    }
    const saida: ResultadoDoXml[] = [];
    for (const [i, arquivo] of validos.entries()) {
      setEnviando({ atual: i + 1, total: validos.length });
      try {
        saida.push(
          await chamar(c.importarXml, {
            entrada: { nome: arquivo.name, base64: await emBase64(arquivo) },
          }),
        );
      } catch (e) {
        saida.push({
          arquivo: arquivo.name,
          status: "erro",
          ctesProcessados: 0,
          cancelamentos: 0,
          orfaos: 0,
          pulados: 0,
          erros: [{ nome: arquivo.name, erro: mensagemAmigavel(e) }],
        });
      }
      setResultados([...saida]);
    }
    setEnviando(null);
    await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => {
          setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void enviar([...e.dataTransfer.files]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-[13px] ${arrastando ? "border-primary bg-primary/5" : "text-muted-foreground"}`}
      >
        <Upload className="h-6 w-6" aria-hidden />
        Arraste os arquivos .xml ou .zip aqui, ou clique para escolher (até {MAX_ARQUIVOS})
        <input
          type="file"
          multiple
          accept=".xml,.zip"
          className="sr-only"
          disabled={enviando !== null}
          onChange={(e) => void enviar([...(e.target.files ?? [])])}
        />
      </label>
      {enviando && (
        <div className="space-y-1 text-[12px]">
          <p>
            Enviando {enviando.atual} de {enviando.total}…
          </p>
          <BarraDeProgresso
            valor={(enviando.atual - 1) / enviando.total}
            rotulo="Envio dos arquivos"
          />
        </div>
      )}
      {resultados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold">Última importação</h3>
          <TabelaDados
            colunas={[
              { chave: "arquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
              {
                chave: "status",
                titulo: "Situação",
                celula: (r) => <SeloStatus status={r.status} />,
                valor: (r) => r.status,
              },
              { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
              { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
              { chave: "orfaos", titulo: "Órfãos", formato: "inteiro" },
              { chave: "pulados", titulo: "Já importados", formato: "inteiro" },
              {
                chave: "erros",
                titulo: "Erros",
                valor: (r) => r.erros.map((e) => `${e.nome}: ${e.erro}`).join("; "),
                classe: "max-w-[320px] truncate",
              },
            ]}
            linhas={resultados}
            chaveDaLinha={(r) => r.arquivo}
            porPagina={0}
          />
        </div>
      )}
    </div>
  );
}

function Historico() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaArquivosXml);
  const [reprocessando, setReprocessando] = useState(false);
  const orfaos = consulta.data?.orfaos;

  const reprocessar = async () => {
    setReprocessando(true);
    try {
      const r = await chamar(c.reprocessarOrfaos);
      toast.success(`${r.casados} de ${r.tentados} XML órfão(s) casado(s)`, {
        description: r.expirados > 0 ? `${r.expirados} expirado(s) (mais de 5 dias).` : undefined,
      });
    } catch (e) {
      toast.error("Não foi possível reprocessar", { description: mensagemAmigavel(e) });
    } finally {
      setReprocessando(false);
      await queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });
    }
  };

  return (
    <TabelaDados
      titulo="Histórico (últimas 50)"
      acoes={
        <div className="flex items-center gap-2 text-[12px]">
          {orfaos && (
            <span className="text-muted-foreground">
              {orfaos.pendentes} XML aguardando o CT-e
              {orfaos.maisAntigo && ` (mais antigo ${dataHora(orfaos.maisAntigo)})`}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[12px]"
            disabled={reprocessando}
            onClick={() => void reprocessar()}
          >
            {reprocessando && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            Reprocessar
          </Button>
        </div>
      }
      colunas={[
        { chave: "criadoEm", titulo: "Data", formato: "datahora" },
        { chave: "nomeArquivo", titulo: "Arquivo", classe: "font-mono max-w-[300px] truncate" },
        { chave: "tipo", titulo: "Tipo" },
        {
          chave: "status",
          titulo: "Situação",
          celula: (a) => <SeloStatus status={a.status} />,
          valor: (a) => a.status,
        },
        { chave: "ctesProcessados", titulo: "CT-e", formato: "inteiro" },
        { chave: "cancelamentos", titulo: "Cancelamentos", formato: "inteiro" },
        { chave: "xmlsPulados", titulo: "Já importados", formato: "inteiro" },
        { chave: "erroMensagem", titulo: "Erro", classe: "max-w-[280px] truncate" },
      ]}
      linhas={consulta.data?.arquivos ?? []}
      chaveDaLinha={(a) => a.id}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      mensagemVazia="Nenhum XML importado ainda."
      porPagina={0}
    />
  );
}

export function PaginaXmlCte() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-[24px] font-semibold">Importação de XMLs CT-e</h1>
      <CartaoFtp />
      <Cartao
        titulo="Upload de XML de CT-e"
        descricao="Completa os CT-e já existentes (chave, endereço, peso, parceiro, chave da NF-e). XML sem CT-e espera 5 dias na fila de órfãos."
      >
        <UploadXml />
      </Cartao>
      <Historico />
    </div>
  );
}
