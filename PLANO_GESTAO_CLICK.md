# Plano de Integracao - Gestao Click

Objetivo: integrar a API da Gestao Click para sincronizar data de nascimento
dos clientes com contatos do Whaticket, via job diario. Sem usar SGP.

## Requisitos definidos
- Criar nova integracao "Gestao Click" (type: gestaoclick) separada do SGP.
- Buscar clientes na API e usar data_nascimento.
- Normalizar telefone/celular mantendo apenas digitos; usar BR como padrao.
- Procurar contato no Whaticket por numero (celular primeiro, fallback telefone).
- Atualizar Contacts.birthDate usando regra de meio-dia local (evitar timezone).
- Atualizar nome apenas quando o identificador for numero (bug atual grava LID no nome).
- Normalizar nome: se estiver TODO EM CAIXA ALTA, converter para "Title Case"
  mantendo "dos", "da", "de" em minusculo
  (ex.: "OSMAR DOS SANTOS" -> "Osmar dos Santos").
- Criar contatos novos somente quando houver birthDate valida e telefone valido.
  Caso contrario, ignorar. Atualizacao segue normal para contatos existentes.
- Job diario (sem sync manual).
- Nao exibir Gestao Click nas listas usadas por bots.
- Exibir na tela da integracao a quantidade de contatos atualizados.
- Persistir quantidade em coluna dedicada (nao jsonContent).
- Se job falhar, registrar falha e mostrar motivo.

## UI (Frontend)
- Arquivo: frontend/src/components/QueueIntegrationModal/index.js
  - Adicionar tipo "gestaoclick" no select.
  - Campos:
    - gcAccessToken
    - gcSecretToken
    - gcBaseUrl (opcional)
  - Persistir em jsonContent.
  - Exibir leitura dos dados:
    - Ultima sincronizacao (timestamp)
    - Total de contatos atualizados
    - Ultimo erro (mensagem de falha)

- Arquivo: frontend/src/pages/QueueIntegration/index.js
  - Opcional: avatar/icone para Gestao Click.

- Nao mostrar Gestao Click nas listas de bots:
  - frontend/src/components/QueueModal/index.js
  - frontend/src/components/WhatsAppModal/index.js
  - Filtrar o tipo gestaoclick desses selects.

## Backend (Modelo e Persistencia)
- Adicionar colunas dedicadas em QueueIntegrations:
  - gcLastSyncAt (datetime)
  - gcUpdatedCount (int)
  - gcLastError (text)
  - Migration nova.
- Manter tokens no jsonContent.

## Backend (Cliente de API)
- Novo client:
  - backend/src/services/IntegrationsServices/GestaoClick/GestaoClickClient.ts
  - Base URL:
    - gcBaseUrl do jsonContent, fallback: https://api.beteltecnologia.com/api
  - Headers:
    - access-token
    - secret-access-token
  - GET /clientes com paginacao (limite 100).
  - Respeitar rate limit (3 req/s) com delay entre chamadas.

## Backend (Servico de Sync)
- Novo servico:
  - backend/src/services/IntegrationsServices/GestaoClick/SyncGestaoClickBirthdaysService.ts
- Fluxo:
  1) Listar QueueIntegrations do tipo gestaoclick por empresa.
  2) Buscar clientes paginados.
  3) Normalizar celular/telefone.
  4) Selecionar celular, fallback telefone.
  5) Procurar Contact por number.
  6) Se existir:
     - Atualizar birthDate com regra de meio-dia local.
     - Atualizar name apenas se for numero (evitar LID no nome).
  7) Contar atualizacoes.
  8) Salvar gcLastSyncAt, gcUpdatedCount.
  9) Se falhar:
     - Registrar gcLastError com motivo.
     - Log de erro por empresa/integracao.

## Job Diario
- Adicionar cron em backend/src/queues.ts
- Exemplo horario: 03:00 BRT
- Execucao:
  - Rodar SyncGestaoClickBirthdaysService para todas as empresas ativas.

## Decisoes confirmadas
- Chave de busca: celular ou telefone (celular primeiro).
- Criar contatos novos somente quando houver birthDate valida e telefone valido.
  Caso contrario, ignorar.
- Atualizar nome somente quando o contato tiver name como numero (conteudo numero).
- Ao atualizar nome, aplicar normalizacao de caixa alta para Title Case
  mantendo "dos", "da", "de" em minusculo.
- DDI/DDD sempre BR.
- Registrar falha e mostrar motivo no UI.

## Pendencias
~~- Validar baseUrl real da API quando tokens estiverem disponiveis.~~
~~- Definir horario exato do cron (03:00 e sugestao).~~
Status: pendencias resolvidas.

## Plano tecnico - Correção de contatos com nome = numero/LID
Objetivo: evitar contatos com nome numérico ou LID e corrigir os já existentes.

### Diagnostico (onde acontece hoje)
- `backend/src/queues.ts`: cria contato com `name: \`${validNumber}\`` (nome vira numero).
- `backend/src/services/ContactServices/CreateOrUpdateContactService.ts`:
  - só atualiza `name` quando `contact.name === number`, então nomes numéricos
    permanecem se não houver outro gatilho.
- `backend/src/jobs/LidSyncJob.ts`: sincroniza `lid` mas não corrige `name`.
- Duplicação LID/numero:
  - `backend/src/services/WbotServices/verifyContact.ts` cria/atualiza contato com `lid`
    e pode gerar um segundo contato quando `remoteJid` vem em formato `@lid`.
  - `backend/src/services/ContactServices/CreateOrUpdateContactService.ts` busca por `lid`
    e por `number`, mas ainda pode criar dois registros quando o LID chega
    antes do número normalizado.

### Regras de normalizacao de nome
- Considerar inválido se:
  - `name` é só dígitos
  - contém `@lid` ou padrão LID
  - comprimento excessivo sem espaços (ex.: 16+ dígitos)
- Fonte de nome (prioridade):
  1) `pushName` da mensagem recebida
  2) nome vindo da API/integração (quando aplicável)
  3) nome do perfil no WA (quando disponível)
  4) fallback: "Contato <numero>"

### Ajustes em fluxo de criação/atualização (sem implementar)
- `backend/src/queues.ts`:
  - ao criar contato, usar `pushName` quando existir
  - evitar `name = number` puro
- `backend/src/services/ContactServices/CreateOrUpdateContactService.ts`:
  - se `contact.name` inválido, substituir pelo melhor nome disponível
  - preservar nomes válidos (não sobrescrever nomes bons)
- Ao receber mensagem com `pushName`, atualizar o nome do contato
  quando o nome atual for inválido/número/LID.
- Deduplicação LID/numero:
  - Garantir que, quando `lid` for detectado, o contato seja sempre
    associado ao `number` normalizado (mesmo registro).
  - Se já existir contato por `number`, atualizar `lid` nele
    e evitar criar novo contato com `number` = LID.
  - Se existir contato por `lid`, migrar `number` para o formato correto
    e consolidar tickets/mensagens (reusar lógica de `verifyContact`).

### Job de limpeza (backfill)
- Script/Job:
  - buscar contatos com `name` inválido
  - tentar resolver nome real (pushName último, perfil WA)
  - atualizar `name` quando encontrar valor válido
- Log:
  - total analisados / corrigidos

### Observacoes
- Não alterar contatos de grupo (isGroup = true) sem validação específica.
- Evitar sobrescrever nomes ajustados manualmente por usuário.

## Plano tecnico - Remover senha enviada na criacao da conta
Objetivo: nao enviar a senha do usuario/empresa por email ou WhatsApp ao criar conta.

### Diagnostico (onde acontece hoje)
- `backend/src/controllers/UserController.ts`:
  - Email de boas-vindas inclui `Senha: ${password}`.
  - Mensagem WhatsApp de cadastro inclui `Senha: ${password}`.

### Ajustes planejados (sem implementar)
- Remover a linha de senha dos templates de email e WhatsApp.
- Substituir por orientacao segura:
  - "Acesse o painel e defina sua senha" ou "Use recuperar senha".
- Manter envio de nome, email e data de vencimento do trial.

## Checklist de implementacao (marcar feito)
- [x] Criar helper `backend/src/utils/contactName.ts` com:
  - `isInvalidContactName`
  - `resolveBestContactName`
- [x] Atualizar `backend/src/queues.ts` (linhas ~201-210):
  - evitar `name = number`
  - usar `pushName` quando existir
  - fallback "Contato <numero>"
- [x] Atualizar `backend/src/services/ContactServices/CreateOrUpdateContactService.ts`:
  - corrigir nome invalido usando helper
  - nao sobrescrever nome valido
  - nao alterar grupos
- [x] Deduplicar LID/numero em `backend/src/services/WbotServices/verifyContact.ts`:
  - consolidar LID no contato do numero
  - impedir criar contato com `number = LID`
  - migrar `number` quando contato existir por LID
- [x] Criar job de backfill:
  - `backend/src/jobs/FixInvalidContactNamesJob.ts`
  - log de analisados/corrigidos
- [x] Remover senha dos templates em `backend/src/controllers/UserController.ts`:
  - email de boas-vindas
  - WhatsApp de boas-vindas
- [ ] Testes manuais:
  - contato com pushName
  - contato sem pushName
  - verificar nao duplicar LID/numero
