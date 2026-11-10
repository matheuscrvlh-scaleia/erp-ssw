# ADR 0006 — Segurança do Admin e da Plataforma

**Status:** aceita (10/11/2026)

## Contexto
A spec 05 descreve o Admin da empresa e a Plataforma, mas deixa brechas que hoje existem no sistema
atual: um admin consegue se promover a Super Admin, trocar o e-mail de alguém da equipe da
Plataforma (e com isso o login dela), gravar em cargo uma tela da Plataforma, e senha/token de
integração ficam em texto. Com RLS por empresa (ADR 0002), um admin também não enxerga os vínculos
de uma pessoa nas outras empresas, que são o que decide se ele pode mexer no login dela.

## Decisão
- **Login de outra pessoa.** Nome/e-mail/senha só mudam se quem pede é a Plataforma, ou se a pessoa
  só tem vínculo na empresa ativa e não é da Plataforma. E-mail e senha de Super Admin: só Super
  Admin. Regras puras em `packages/dominio/src/administracao.ts` (`exigirPodeAlterarLogin`,
  `exigirPodeMexerEmSuperAdmin`). Os vínculos nas outras empresas são lidos por um executor de
  Plataforma **só leitura** (`executorDePlataforma`), dentro do caso de uso.
- **Super Admin.** Dar ou tirar o papel exige Super Admin ou Plataforma.
- **Telas de cadastro.** Cargo, departamento e exceção de usuário só gravam `TELAS_GRAVAVEIS`
  (nunca `plataforma_*` nem as concedidas por regra, como Logs).
- **Definir senha** de outra pessoa revoga as sessões dela (motivo `senha_redefinida`).
- **Convite tudo-ou-nada** (Q36): usuário, vínculo, token e e-mail na mesma transação; falha no envio
  desfaz tudo.
- **Segredos de integração** cifrados com AES-256-GCM (chaves `SEGREDOS_CHAVES`, versão por linha),
  com dado autenticado `empresa:tipo` (copiar o valor cifrado para outra empresa não decifra). A API
  nunca devolve o segredo; auditoria registra só "definido/removido"; o log do servidor mascara
  `segredo`. Parâmetro com nome de senha/token em `parametros` é recusado.
- **Guards no `onRequest`** nas rotas de Admin e Plataforma: quem não tem acesso toma 401/403 antes
  de o corpo ser lido e validado (o logo tem até 750 KB).
- **Logo** só PNG/JPEG conferido pelo conteúdo (assinatura), até 512 KB, nome novo a cada envio.

## Consequências
- Mudança visível (linha em `docs/mudancas-visiveis.md`): admin comum não promove ninguém a Super
  Admin e não muda o login de quem tem outras empresas ou é da Plataforma.
- Produção exige `SEGREDOS_CHAVES`; sem chave a gravação de segredo responde 503.
- Testes de segurança em `apps/api/src/modulos/{usuarios,plataforma}/rotas.test.ts`.
