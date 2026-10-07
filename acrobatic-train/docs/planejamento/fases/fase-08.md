# Fase 8 — Corredor de precisão

Status: implementada na M4 e validada automaticamente em 07/10/2026. [Resultados](../VALIDACAO_M4.md). Playtest humano pendente. Conteúdo e valores efetivos estão em src/levels/level-config.js e nas fixtures/replays. Entrega: M4. Dependência: Fase 7 e budgets/rotas difíceis validados. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Alternar alinhamento e leitura temporal com precisão, preservando a possibilidade de planejar a próxima ação.

Briefing: “Escolha a via com antecedência. Alinhe antes das aberturas e respeite os avisos dos cruzamentos.”

Objetivo opcional: Concluir sem colisão em pórtico; a conclusão já exige sobrevivência, sem bônus adicional. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-08` / `acrobatic-campaign-v1-08` |
| Dificuldade | Difícil |
| Comprimento | 1400 m |
| Velocidade inicial → limite | 28 → 39 m/s; 100.8 → 140.4 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 1320–1400 m |
| Aviso / descanso desejados | ≥ 1,60 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

Aviso candidato de 1,60 s, igual ao grupo difícil; a dificuldade cresce pela velocidade e seleção de rotas, não pela supressão de aviso. Janelas de cancela podem ser menores que na fase 4, mas rota alternativa continua válida e recebe orçamento completo. Até duas famílias perigosas por encontro; nenhum evento móvel exige coincidência de sorte.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Sem perigo | Rever os símbolos |
| 130–170 | Cancela central | C; L/R livres | Antecipar lateral ou passar em janela validada |
| 310–350 | Abertura R | Pórtico isolado R | Entrar R/R alinhado |
| 490–535 | Cruzamento espelhado | Vagão R→C; L livre | Preparar L/L; validar mudança a partir de R |
| 675–720 | Rampa e gap | Rampa L opcional; gap C; R contínua | Escolher rota terrestre R ou salto validado em L |
| 870–915 | Cancela e postes | Cancela R; postes entre vias; L alinhada livre | Evitar diagonal; ficar L/L |
| 1060–1110 | Aberturas sucessivas | Abertura R e depois C; âncoras/subvolumes separados | Mudar e alinhar antes da segunda; alongar espaço se o budget falhar |
| 1230–1260 | Último reparo | Gap L/C; R contínua | Entrar R/R sem manobra nova |
| 1320–1400 | Chegada | Sem perigo | Liberar 9 |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Projetar pares de saída/entrada para a alternância R→L e L→R→C, incluindo comandos simultâneos possíveis.
2. Definir janela real da cancela menor apenas se houver alternativa livre e compreensível.
3. Usar âncoras exatas nas aberturas sucessivas; envelope não autoriza colisores próximos demais.
4. Medir avisos na câmera portrait em 39 m/s e ajustar posição/câmera antes de aceitar.
5. Gravar rota canônica e testes de borda nas janelas, volumes e mudança de via.
6. Escrever fixture `tests/fixtures/levels/level-08.json` e replay(s) `tests/fixtures/replays/level-08.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar resultado/desbloqueio e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F08-A01 | Alternância entre vias é alcançável com controles reais. |
| F08-A02 | Janelas menores da cancela preservam rota alternativa. |
| F08-A03 | Pórticos sucessivos respeitam tempo de troca/alinhamento. |
| F08-A04 | O reparo final não invade zona de chegada. |
| F08-A05 | Dificuldade vem da execução, com avisos legíveis. |
| F08-A06 | Vitória libera a final sem alterar compras ou troféu antecipadamente. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F08-T01 | Replays R/R→L/L e L/L→R/R→C/C nos encontros designados. | Mudanças completam antes do contato; não exigem input mais rápido que o domínio aceita. | F08-A01 |
| F08-T02 | Offsets variados e inputs fora da janela ótima → usar lateral. | Rota alternativa conclui sem sorte; colisor fechado tem aviso suficiente. | F08-A02 |
| F08-T03 | Medir saída da primeira abertura e entrada da segunda em max speed. | Folga longitudinal comporta crossTime/reação; caso contrário layout é recusado e ajustado. | F08-A03 |
| F08-T04 | Validar volume completo de todos os gaps e trajeto móvel, com extensão longitudinal. | Nenhum perigo em 1320–1400; via R contínua no último reparo. | F08-A04 |
| F08-T05 | Playtest desktop/touch e medição do orçamento por encontro. | Avisos ≥ fórmula/1,60 s; causa da derrota visível; sem ocultar obstáculos por cenário/câmera. | F08-A05 |
| F08-T06 | Concluir 8 com score 0, reload, repetir e perder. | 9 liberada quando entregue; troféu ainda ausente; compras/progresso máximo mantidos. | F08-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
