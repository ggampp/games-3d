# Fase 6 — Cruzamento em movimento

Status: planejada; sem implementação/testes executados. Entrega: M3. Dependência: Fase 5; vagão móvel e detecção contínua de M3. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Antecipar um obstáculo móvel e manter uma rota de escape enquanto ele cruza o percurso.

Briefing: “O vagão de manutenção cruza a via. Observe sua direção e desvie antes do cruzamento.”

Objetivo opcional: Passar por todos os cruzamentos sem colisão; não adicionar bônus de conclusão. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-06` / `acrobatic-campaign-v1-06` |
| Dificuldade | Média |
| Comprimento | 1200 m |
| Velocidade inicial → limite | 24 → 33 m/s; 86.4 → 118.8 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 1120–1200 m |
| Aviso / descanso desejados | ≥ 2,00 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

O vagão se move em coordenadas do percurso em trecho reto e tem trajetória/startTick definidos na fixture. Aviso inclui direção, não apenas cor. Presença visual começa fora das vias com antecedência suficiente; nenhuma trajetória surge dentro da locomotiva. Varredura contínua considera movimento relativo de trem e vagão entre ticks.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Sem perigo | Mostrar seta de travessia |
| 130–175 | Primeira travessia | Vagão cruza L→C e recua; R reservada livre | Mover para R/R; novidade isolada |
| 330–375 | Travessia espelhada | R→C; L reservada livre | Antecipar saída para L |
| 540–590 | Travessia com coleta | L→C; R contínua; itens em R | Desviar sem precisar coletar |
| 770–815 | Rampa de revisão | Rampa C opcional; via terrestre livre | Pouso termina antes do próximo encontro |
| 990–1040 | Cruzamento e reparo | Gap em C; travessia em L; R com envelope livre | Chegar em R/R; validar tempo entre pouso e decisão |
| 1120–1200 | Chegada | Sem perigo nem trajetória móvel invadindo faixa | Liberar fase 7 |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Fixar trajetória temporal de cada vagão no conteúdo e projetá-la no percurso reto.
2. Calcular ocupação conjunta com gap/pouso; não presumir que R está livre sem validar toda a trajetória.
3. Implementar teste de contato que ocorre entre duas amostras, na velocidade máxima.
4. Mostrar direção e cronograma do perigo com mesh/aviso coerentes; som auxiliar respeita mute.
5. Gravar replay de escape, de colisão e de pouso→desvio; verificar diferentes FPS de render.
6. Escrever fixture `tests/fixtures/levels/level-06.json` e replay(s) `tests/fixtures/replays/level-06.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar resultado/desbloqueio e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F06-A01 | Primeiro vagão é visto antes de entrar na via e com direção clara. |
| F06-A02 | O móvel não atravessa o trem entre ticks. |
| F06-A03 | Rota de escape está livre durante todo o encontro. |
| F06-A04 | Pausa/retry mantêm a trajetória reproduzível. |
| F06-A05 | Rampa anterior não força pouso no cruzamento final. |
| F06-A06 | Conclusão libera 7 e recursos móveis são descartados. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F06-T01 | Chegar ao primeiro cruzamento em max speed, desktop/touch. | Aviso legível pelo budget; mesh não aparece em cima do trem; seta indica o movimento real. | F06-A01 |
| F06-T02 | Fixture em que endpoints estão separados mas trajetórias se cruzam. | Uma colisão detectada; resultado independe do FPS de render. | F06-A02 |
| F06-T03 | Amostras temporais e replay pelas vias R/L anunciadas. | Sem ocupação pelo vagão ou gap na rota; dois truques alcançam a via antes do risco. | F06-A03 |
| F06-T04 | Pausar durante cruzamento, retomar e reiniciar a fase. | Pausa congela posição; retry produz mesma seed/startTick/layout; nenhuma animação antiga fica ativa. | F06-A04 |
| F06-T05 | Executar variante com salto e variante terrestre até último encontro. | Ambas conseguem alcançar R/R com budget após pouso; nenhum salto/collision timing impossível. | F06-A05 |
| F06-T06 | Concluir/reload e repetir 30 ciclos com instrumentação. | 7 liberada quando entregue; vagões/listeners/timers retornam ao baseline. | F06-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
