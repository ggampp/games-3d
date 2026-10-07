# Planejamento detalhado — Acrobatic Train

Data: 06/10/2026. Origem: [plano geral](../../PLANO_FEATURES_TRANSCRICAO.md) e [transcrição](../../transcricao_audio_trem.md).

**M0/M1 validadas; M2 (06/10/2026), M3 e M4 (07/10/2026) implementadas com validação automatizada aprovada**. [Relatório M4](VALIDACAO_M4.md), [relatório M3](VALIDACAO_M3.md), [relatório M2](VALIDACAO_M2.md), [histórico M0/M1](VALIDACAO_M0_M1.md). Campanha solo de nove fases e troféu disponíveis; M5–M6 permanecem planejados. Os gates humanos da M2, M3 e M4 continuam pendentes.

## Como executar o planejamento

1. Ler [contratos comuns](CONTRATOS.md) e [estratégia de testes](TESTES.md).
2. Começar em M0 depois da entrega da Train Shop. Implementar M1 e validar uma fase completa antes de produzir o restante do conteúdo.
3. Para cada marco, executar as tarefas na ordem registrada, implementar os testes associados e guardar a evidência dos aceites.
4. Usar os documentos das fases como especificação de conteúdo. Uma fase só fica pronta quando satisfaz tanto seus aceites locais quanto os aceites comuns `C-*`.
5. Atualizar o status somente com evidência: `planejado` → `em implementação` → `em validação` → `concluído`. Falha crítica impede concluir o marco ou a fase.

## Etapas de implementação

| Marco | Documento | Entrega | Dependência |
| --- | --- | --- | --- |
| M0 | [Integração da Train Shop](marcos/m0-integracao-loja.md) | Contratos e regressão da loja, controles e economia | Entrega do outro agente |
| M1 | [Base da campanha](marcos/m1-base-campanha.md) | Estado, simulação, chegada e retry na fase 1 | M0 |
| M2 | [Fases fáceis](marcos/m2-fases-faceis.md) | Fases 1–3, save, seleção, HUD e coleta aérea | M1 |
| M3 | [Fases médias](marcos/m3-fases-medias.md) | Fases 4–6 e obstáculos novos | M2 |
| M4 | [Campanha completa](marcos/m4-campanha-completa.md) | Fases 7–9, troféu e modo infinito | M3 |
| M5 | [Multiplayer](marcos/m5-multiplayer.md) | Dois clientes, salas e resultado no servidor | M4; formato ainda provisório |
| M6 | [Mods](marcos/m6-mods.md) | Pacotes declarativos e catálogo gradual | M4; independente da entrega de M5 |

Preparar dados e testes de módulos puros pode ocorrer antes de M0. Alterações de integração em arquivos da loja aguardam sua entrega. O planejamento não autoriza enviar mensagens ao outro agente nem publicar versões.

## Nove fases jogáveis

| Fase | Documento | Dificuldade | Marco de entrega |
| --- | --- | --- | --- |
| 1 | [Saída da estação](fases/fase-01.md) | Fácil | M1: versão básica; M2: conteúdo completo |
| 2 | [Trilhos em reparo](fases/fase-02.md) | Fácil | M2 |
| 3 | [Primeiro voo](fases/fase-03.md) | Fácil | M2 |
| 4 | [Cancela ferroviária](fases/fase-04.md) | Média | M3 |
| 5 | [Ponte de manobras](fases/fase-05.md) | Média | M3 |
| 6 | [Cruzamento em movimento](fases/fase-06.md) | Média | M3 |
| 7 | [Sequência acrobática](fases/fase-07.md) | Difícil | M4 |
| 8 | [Corredor de precisão](fases/fase-08.md) | Difícil | M4 |
| 9 | [Desafio final](fases/fase-09.md) | Extrema, solucionável | M4 |

Cada arquivo contém configuração, roteiro de encontros, tarefas de conteúdo, dependências, aceites identificados e testes com precondição/ação/resultado esperado.

## Regras de escopo

- Train Shop continua sob responsabilidade do outro agente; não recriar catálogo, saldo, compras ou modelos.
- Campanha oficial pode ser vencida com o trem gratuito, sem meta obrigatória de pontos e sem IA disponível.
- Mods significam plataforma extensível e expansão gradual. Não é uma encomenda de 365 pacotes.
- Multiplayer segue provisoriamente a proposta de dois jogadores online com trens próprios e atributos iguais. A preferência do usuário pode mudar M5 sem bloquear M1–M4.
- Não há prazo fechado. Estimar esforço restante depois de integrar a loja e concluir a fase 1 com testes.

## Evidência atual e limites

Na leitura desta etapa, `tests/architecture-spec.test.js` existe. Seus testes procuram strings como `JUMP_G`, `throttleInterval` e `.dispose()`; não medem colisão, desacoplamento em execução ou vazamento de recursos. A presença desse arquivo atualiza o inventário anterior, que não o encontrou.

Os módulos/fixtures/comandos M0/M1 já implementados estão no relatório. Os demais nomes continuam propostas; gameplay de M2–M4, rede e mods ainda precisam dos testes descritos nos seus marcos.

O guardrail Jev aprovou a proposta de criação destes documentos. A aprovação não é validação das features. A checagem desta entrega verifica organização, links e rastreabilidade dos aceites; não substitui testes do jogo.

O planejamento inicial contém 19 documentos, acrescidos dos relatórios M0/M1 e M2. Há 102 aceites locais ligados a 102 casos de teste planejados, mais dez aceites e dez testes comuns. Os casos comuns devem ser executados para cada fase; 112 é o total de especificações distintas, não de execuções nem de testes já implementados.
