import * as oidc from "openid-client";

/** O que precisa ficar guardado (cookie assinado) entre a ida ao Google e a volta. */
export interface DesafioGoogle {
  verificador: string;
  estado: string;
  nonce: string;
}

export interface IdentidadeGoogle {
  sujeito: string;
  email: string;
  emailVerificado: boolean;
}

export interface ProvedorGoogle {
  iniciar(): Promise<{ url: string; desafio: DesafioGoogle }>;
  concluir(urlDeRetorno: URL, desafio: DesafioGoogle): Promise<IdentidadeGoogle>;
}

interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** OpenID Connect com PKCE (S256), `state` e `nonce`. A descoberta só acontece no 1º uso. */
export function criarProvedorGoogle(config: ConfigGoogle): ProvedorGoogle {
  let descoberta: Promise<oidc.Configuration> | undefined;
  const configuracao = () => {
    descoberta ??= oidc.discovery(
      new URL("https://accounts.google.com"),
      config.clientId,
      config.clientSecret,
    );
    return descoberta;
  };

  return {
    iniciar: async () => {
      const desafio: DesafioGoogle = {
        verificador: oidc.randomPKCECodeVerifier(),
        estado: oidc.randomState(),
        nonce: oidc.randomNonce(),
      };
      const url = oidc.buildAuthorizationUrl(await configuracao(), {
        redirect_uri: config.redirectUri,
        scope: "openid email",
        code_challenge: await oidc.calculatePKCECodeChallenge(desafio.verificador),
        code_challenge_method: "S256",
        state: desafio.estado,
        nonce: desafio.nonce,
        prompt: "select_account",
      });
      return { url: url.href, desafio };
    },

    concluir: async (urlDeRetorno, desafio) => {
      const tokens = await oidc.authorizationCodeGrant(await configuracao(), urlDeRetorno, {
        pkceCodeVerifier: desafio.verificador,
        expectedState: desafio.estado,
        expectedNonce: desafio.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims || typeof claims.email !== "string") {
        throw new Error("O Google não devolveu o e-mail.");
      }
      return {
        sujeito: claims.sub,
        email: claims.email,
        emailVerificado: claims.email_verified === true,
      };
    },
  };
}
