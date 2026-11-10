import { ErroDeNegocio } from "@erp/dominio/erros";
import { mensagemModuloDesligado } from "@erp/shared/acesso/modulos";

export const naoAutenticado = () =>
  new ErroDeNegocio("NAO_AUTENTICADO", "Entre com sua conta para continuar.");

export const sessaoExpirada = () =>
  new ErroDeNegocio("SESSAO_EXPIRADA", "Sua sessão expirou. Entre novamente.");

export const semPermissao = (mensagem = "Você não tem permissão para esta ação.") =>
  new ErroDeNegocio("SEM_PERMISSAO", mensagem);

export const semEmpresa = () =>
  new ErroDeNegocio(
    "SEM_EMPRESA",
    "Sua conta não está ligada a nenhuma empresa ativa. Fale com o administrador.",
  );

export const moduloNaoLiberado = (nomes: readonly string[]) =>
  new ErroDeNegocio("MODULO_NAO_LIBERADO", mensagemModuloDesligado(nomes));

export const naoEncontrado = (mensagem: string) => new ErroDeNegocio("NAO_ENCONTRADO", mensagem);

export const muitasTentativas = () =>
  new ErroDeNegocio(
    "MUITAS_TENTATIVAS",
    "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  );
