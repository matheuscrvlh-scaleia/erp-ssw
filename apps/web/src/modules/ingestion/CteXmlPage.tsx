/**
 * Admin › XML CT-e (só Plataforma): sincronização automática do FTP (relatórios SSW) e upload
 * manual de XML de CT-e (Q43: a chave da NF-e passa a ser gravada).
 */
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Upload } from "lucide-react";

import { Painel } from "@/components/common/Panel";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { chaves, consultaFtp } from "./api";
import { CartaoFtp } from "./components/FtpCard";
import { UploadXml } from "./components/XmlUpload";

export function PaginaXmlCte() {
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: chaves.tudo }) > 0;
  const ftp = useQuery(consultaFtp);
  return (
    <Pagina
      titulo="Importação de XMLs CT-e"
      descricao="Sincronização automática do FTP e upload manual de XML de CT-e"
      acoes={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void queryClient.invalidateQueries({ queryKey: chaves.tudo })}
          disabled={atualizando}
        >
          <RefreshCw className={cn(atualizando && "motion-safe:animate-spin")} aria-hidden />
          Atualizar
        </Button>
      }
    >
      <CartaoFtp dados={ftp.data} erro={ftp.error} aoTentarDeNovo={() => void ftp.refetch()} />
      <Painel
        icone={Upload}
        titulo="Upload de XML de CT-e"
        descricao="Completa os CT-e já existentes (chave, endereço, peso, parceiro, chave da NF-e). XML sem CT-e espera 5 dias na fila de órfãos."
        classeDoCorpo="p-5"
      >
        <UploadXml />
      </Painel>
    </Pagina>
  );
}
