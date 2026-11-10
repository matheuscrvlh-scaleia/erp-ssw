# ADR 0009 — Webhook SSW: quarentena de "token incorreto" e reprocesso por SHA-256

**Status:** aceita (10/11/2026)

## Contexto
O webhook SSW2181 gravava o corpo de toda chamada de empresa conhecida, inclusive sem token
válido, e o botão "Reprocessar webhooks rejeitados por token" transformava esse corpo em ocorrência.
Qualquer um que soubesse o slug da empresa (`?empresa=`) gravava dado no banco e, com um clique da
Plataforma, no CT-e. Mas existe um caso legítimo: o SSW troca o token antes de nós (ou nós antes
dele) e as ocorrências do intervalo precisam entrar depois.

## Decisão
- **Nunca o token**: a recepção guarda só o SHA-256 de cada candidato a token (`token_sha256`):
  os candidatos do header, o header inteiro, o `?secret=` e, para o caso "contém" (o SSW embrulha
  o segredo no header), cada trecho do header com o comprimento do segredo atual (até 128).
- **Segredo anterior**: trocar o segredo do webhook na Plataforma guarda o que sai em
  `segredo_anterior_cifrado` (mesmo contexto de cifra).
- **Quarentena estreita**: chamada recusada grava só metadados (IP, user-agent, motivo, resumo do
  token, data). O corpo só é guardado quando pode ser o caso legítimo: empresa pedida por
  `?empresa=`, token presente mas errado, corpo até 16 KB que é uma ocorrência SSW2181 válida de
  CNPJ aceito, e no máximo 1000 corpos guardados por empresa em 24 h.
- **Reprocesso por resumo**: só volta à fila o evento cujo `token_sha256` contém o SHA-256 do
  segredo atual ou do anterior, decifrados na hora do reprocesso. O evento passa a `autenticado`;
  o worker recusa evento não autenticado e reaplica `cnpjs_aceitos`. O resto nunca vira dado.
- **Falhas com limite próprio**: mais de 30 falhas de autenticação por IP por minuto recebem 429 e
  nada é gravado (contador no Redis; o limite geral da rota continua 6000/min para o SSW em rajada).

## Consequências
- Um atacante sem o segredo consegue no máximo guardar até 16 MB/dia por empresa, que nunca viram
  dado e somem na retenção de 90 dias.
- Trocar o token com comprimento diferente do atual e o SSW mandá-lo embrulhado ("contém") deixa
  o intervalo sem reprocesso; com o token exato no header ou no `?secret=` funciona sempre.
- Eventos migrados do sistema atual não têm resumo: os recusados não são reprocessáveis, e o
  migrador não copia o corpo das chamadas não autenticadas.
