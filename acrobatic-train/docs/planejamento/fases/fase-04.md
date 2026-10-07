# Fase 4 — Cancela ferroviária

Status: implementada na M3 e validada automaticamente em 07/10/2026. [Resultados](../VALIDACAO_M3.md). Playtest humano pendente. Conteúdo e valores efetivos estão em src/levels/level-config.js e nas fixtures/replays. Entrega: M3. Dependência: Fase 3; cancela temporizada, relógio e volume físico de M3. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Ler o aviso de fechamento e escolher uma via aberta sem depender de parar o trem.

Briefing: “A cancela fecha por tempo. Observe o aviso e use uma via livre.”

Objetivo opcional: Passar por uma cancela aberta em vez de desviar; opcional, sem recompensa adicional. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-04` / `acrobatic-campaign-v1-04` |
| Dificuldade | Média |
| Comprimento | 950 m |
| Velocidade inicial → limite | 20 → 27 m/s; 72.0 → 97.2 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 870–950 m |
| Aviso / descanso desejados | ≥ 2,00 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

Ciclo inicial candidato de 8 s: aberta 3 s, aviso 2 s, fechada 2 s, reabertura 1 s. O tempo é da simulação; o colisor corresponde à posição real da haste, com limites testados durante abertura/fechamento. A fixture define phaseOffsetS por cancela e usa a chegada prevista do replay só para projetar o conteúdo, não para forçar o resultado. Sempre existe rota lateral independente do ciclo.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Sem perigo; C/C | Apresentar símbolo/texto da cancela |
| 110–150 | Primeira cancela | C; L/R livres | Aviso isolado, desviar ou passar na janela aberta |
| 280–320 | Cancela lateral | L; C/R livres | Manter via contínua se não quiser sincronizar |
| 450–490 | Cancelas alternadas | L e R em âncoras distintas; C livre | Ler os dois ciclos; rota C não depende de sorte |
| 620–665 | Cancela e coleta | R; itens opcionais em via segura | Não seguir item se cancela bloqueia |
| 770–815 | Revisão | C; laterais livres | Aplicar leitura/antecipação |
| 870–950 | Chegada | Sem perigo | Liberar fase 5 |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Implementar cronograma de estados/ciclo por cancela e relacionar o mesmo estado ao volume, aviso, som e mesh.
2. Validar contato durante fechamento/reabertura; nenhuma troca instantânea invisível do colisor.
3. Autorizar rota independente do ciclo e replay que passa na janela aberta como desafio opcional.
4. Pausar no meio do ciclo e confirmar que tudo congela, inclusive aviso.
5. Criar fixtures nas fronteiras de tempo do ciclo e replays de passagem/desvio.
6. Escrever fixture `tests/fixtures/levels/level-04.json` e replay(s) `tests/fixtures/replays/level-04.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar resultado/desbloqueio e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F04-A01 | A primeira cancela é isolada e anuncia o fechamento com budget suficiente. |
| F04-A02 | Ciclo e volume são iguais no cliente/simulação, inclusive transição. |
| F04-A03 | Pausa congela ciclo, aviso e posição. |
| F04-A04 | Rota segura independe da sorte do ciclo. |
| F04-A05 | Janela fechada colide; janela aberta permite o desafio. |
| F04-A06 | Conclusão libera 5 e coleta não obriga janela estreita. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F04-T01 | Entrar no primeiro encontro em max speed por desktop/touch. | Aviso legível pelo tempo calculado; alternativa alcançável antes do contato. | F04-A01 |
| F04-T02 | Amostras nos limites de aberta/aviso/fechada/reabertura → testar volume e mesh. | Não há haste fechada sem colisão ou aberta com volume residual; fronteiras têm regra explícita. | F04-A02 |
| F04-T03 | Pausar 5 s reais durante aviso → retomar. | Tempo da simulação e haste iguais antes/depois da pausa; ciclo retoma do mesmo ponto. | F04-A03 |
| F04-T04 | Testar offsets de ciclo 0/2/4/6 s com a rota C/lateral validada. | Uma rota completa por variante; não criar barreira simultânea nas alternativas. | F04-A04 |
| F04-T05 | Mesma via → atravessar em estado fechado e aberto. | Derrota apenas com contato físico; aberto passa; resultado consistente com interpolação. | F04-A05 |
| F04-T06 | Ignorar coleta/janelas → chegar e reload. | 5 liberada quando entregue; score zero permitido; sem bônus extra. | F04-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
