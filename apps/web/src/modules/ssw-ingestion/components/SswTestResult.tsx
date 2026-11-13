import { type ResultadoDoTesteSsw as Resultado } from "@erp/shared/contracts/ssw-ingestion";

import { Aviso } from "@/components/common/Notice";

const MENSAGEM_DA_FALHA = {
  upstream_unavailable: "SSW está com instabilidade — não é problema das credenciais.",
  permission_denied: "O usuário da API não tem permissão no SSW.",
  auth_failed: "O SSW recusou o login. Revise usuário, senha e domínio.",
} as const;

/** Resultado do "Testar conexão" (o pendente só avisa por toast). */
export function ResultadoDoTesteSsw({ resultado }: { resultado: Resultado }) {
  return (
    <Aviso
      tom={resultado.ok ? "sucesso" : "erro"}
      titulo={
        <>
          {resultado.ok ? "Conexão OK" : "Falha na conexão"}
          {resultado.renovado && " · token renovado"}
          {resultado.tokenPrevia && (
            <span className="ml-1 font-mono font-normal">{resultado.tokenPrevia}</span>
          )}
        </>
      }
    >
      <p className="break-words">{resultado.mensagem}</p>
      {resultado.tipoFalha && <p>{MENSAGEM_DA_FALHA[resultado.tipoFalha]}</p>}
    </Aviso>
  );
}
