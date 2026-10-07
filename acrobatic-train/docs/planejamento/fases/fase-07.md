# Fase 7 — Sequência acrobática

Status: implementada na M4 e validada automaticamente em 07/10/2026. [Resultados](../VALIDACAO_M4.md). Playtest humano pendente. Conteúdo e valores efetivos estão em src/levels/level-config.js e nas fixtures/replays. Entrega: M4. Dependência: Fase 6 e todas as famílias/colisões aprovadas em M3. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Combinar duas habilidades já aprendidas com menos descanso e transições planejadas.

Briefing: “Combine salto, desvio e alinhamento. Leia o próximo encontro antes de escolher a saída.”

Objetivo opcional: Executar uma manobra e uma sequência de alinhamento na mesma tentativa; métricas opcionais. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-07` / `acrobatic-campaign-v1-07` |
| Dificuldade | Difícil |
| Comprimento | 1300 m |
| Velocidade inicial → limite | 26 → 36 m/s; 93.6 → 129.6 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 1220–1300 m |
| Aviso / descanso desejados | ≥ 1,60 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

Nenhuma família inédita. No máximo duas famílias perigosas por encontro; itens não contam como família perigosa. Aviso candidato de 1,60 s, ampliado quando o número de mudanças ou pouso exigir. Rampa+gap deve ter alternativa terrestre; não impor salto para ganhar. Estado de saída do salto entra na validação do próximo encontro.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Sem perigo | Rever símbolos conhecidos |
| 120–165 | Rampa e reparo | Rampa C; gap C após rampa; R/L contínuas | Saltar pela rota validada ou usar solo lateral |
| 310–355 | Cancela e postes | Cancela R; postes entre vias; C alinhada livre | Ficar C/C e evitar postura diagonal |
| 500–545 | Pórtico e reparo | Abertura L; gap em R antes do pórtico | Preparar L/L sem salto |
| 690–740 | Móvel e reparo | Vagão L→C; gap C; R reservada | Escapar em R/R após o encontro anterior |
| 900–945 | Rampa de revisão | Rampa R e gap R; C contínua | Voar opcionalmente ou preservar caminho terrestre |
| 1100–1145 | Cancela e abertura | Cancela L antes de abertura C, com envelopes separados | Chegar C/C com descanso validado entre perigos |
| 1220–1300 | Chegada | Sem perigo | Liberar 8 |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Compor só famílias aprovadas; registrar quantidade por encontro para limitar complexidade.
2. Gravar rota terrestre canônica e rota opcional acrobática; nenhuma habilidade opcional bloqueia a chegada.
3. Validar pouso e estado diagonal antes do alinhamento seguinte; não impor mudança durante controle bloqueado.
4. Garantir que combinação não sobreponha cronogramas para fechar todas as rotas.
5. Rerodar conteúdo após qualquer alteração de velocidade e registrar orçamento efetivo dos avisos.
6. Escrever fixture `tests/fixtures/levels/level-07.json` e replay(s) `tests/fixtures/replays/level-07.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar resultado/desbloqueio e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F07-A01 | Cada encontro combina no máximo duas famílias perigosas conhecidas. |
| F07-A02 | Rota terrestre e acrobática são ambas completas. |
| F07-A03 | Pouso permite decisão/alinhamento do próximo encontro. |
| F07-A04 | Móvel+gap mantém R livre e alcançável. |
| F07-A05 | Menor descanso não reduz aviso abaixo do orçamento. |
| F07-A06 | Chegada libera 8; derrota comunica causa corrigível. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F07-T01 | Inspecionar registro/fixture e tentar inserir uma terceira família. | Conteúdo oficial respeita limite; validador ou teste rejeita o excesso; nenhuma introdução nova oculta. | F07-A01 |
| F07-T02 | Executar os dois replays com cyber em max speed. | Ambos chegam vivos; salto não é requisito e não depende de IA. | F07-A02 |
| F07-T03 | Replay acrobático → medir estado de saída e tempo até o pórtico/cancela seguinte. | Controle disponível e aviso suficiente para mudanças; nenhuma janela consumida durante salto sem alternativa. | F07-A03 |
| F07-T04 | Replay do encontro de 690–740 com trajetória completa e estado anterior real. | Ambos os truques conseguem R/R; gap e móvel não invadem a rota. | F07-A04 |
| F07-T05 | Inspecionar primeiro contato de cada encontro na velocidade máxima e câmera mobile. | Tempo real de aviso ≥ max(1,60 s, fórmula); descanso e transições válidos. | F07-A05 |
| F07-T06 | Concluir/reload e observar derrota em cada família no playtest. | 8 liberada; mensagens identificam obstáculo; jogador consegue planejar correção sem reduzir visibilidade. | F07-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
