# Plano de limpeza da base de dados

Este projeto passa a ser uma aplicação interna de gestão de formação de um clube desportivo.

## Base de dados alvo

A base de dados ativa deve ser `clube_formacao`.

## Não apagar sem confirmação

Antes de remover dados reais, confirmar com o utilizador. Até lá, os scripts só devem criar ou atualizar dados coerentes com o clube.

## Coleções antigas a substituir no domínio

- `products`: passam a representar planos/grupos de inscrição enquanto não houver renomeação física.
- `categories`: passam a representar modalidades e escalões enquanto não houver renomeação física.
- `orders`: passam a representar inscrições/candidaturas enquanto não houver renomeação física.
- `storeSettings`: passa a representar configurações do clube enquanto não houver renomeação física.
- `campaigns`: deve deixar de ser usada na navegação principal.
- `reviews`: deve deixar de ser usada, porque avaliações de produtos não fazem sentido neste contexto.

## Remoção futura sugerida

Confirmar antes de apagar:

- Campanhas/cupões antigos.
- Reviews antigos.
- Imagens antigas de produtos demo.
- Produtos ou categorias antigas que não correspondam a modalidades/escalões.
- Encomendas antigas de loja, se existirem.

## Seed limpa pretendida

Criar apenas:

- Configuração do clube.
- Época desportiva.
- Modalidades.
- Escalões.
- Planos/grupos de inscrição com vagas.
- Admin inicial, apenas se existirem variáveis `ADMIN_USERNAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Renomeação estrutural futura

Quando houver tempo para uma refatoração completa:

- `Product` -> `TrainingGroup` ou `EnrolmentPlan`.
- `Category` -> `Modality` e `AgeGroup`.
- `Order` -> `Enrolment`.
- `StoreSettings` -> `ClubSettings`.
- Remover `Campaign` e `Review`, ou substituir por módulos próprios se forem necessários.
