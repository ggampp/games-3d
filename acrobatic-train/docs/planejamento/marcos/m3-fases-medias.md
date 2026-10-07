# M3 — Fases 4–6 e novas famílias de obstáculos

Status: implementado em 07/10/2026; validação automatizada aprovada; gate humano M3-A07 pendente. [Relatório por aceite](../VALIDACAO_M3.md). Dependência: [M2](m2-fases-faceis.md). Próximo: [M4](m4-campanha-completa.md). Conteúdo: [4](../fases/fase-04.md), [5](../fases/fase-05.md), [6](../fases/fase-06.md).

## Objetivo

Introduzir cancela temporizada, pórtico de alinhamento e vagão móvel. Cada novidade aparece isoladamente antes de combinar com o repertório anterior. Não aumentar dificuldade ocultando obstáculos.

## Tarefas na ordem de execução

1. Criar registro de obstáculos: família → configuração/volume/animação/validação/dispose. Dados usam coordenadas do percurso; rendering projeta a posição.
2. Implementar cancela com ciclo de simulação, aviso antes do fechamento e transição física definida. Render e colisor usam o mesmo estado.
3. Implementar pórtico com abertura: volumes laterais/teto explícitos; não usar mera checagem de via central.
4. Implementar vagão cruzando em trecho reto; trajetória por tempo/seed, ocupação e aviso. Evitar tunneling com varredura contínua ou subpassos justificados por velocidade/tamanho.
5. Validar orçamento de movimento de dois truques e reação a cada encontro. Compor conteúdo 4–6 somente após testes individuais dos obstáculos.
6. Estender validador de rotas a estados temporais dos móveis; validar fronteiras de segmentos e do pouso para encontros seguintes.
7. Ativar desbloqueio até 6; dados/avisos/resultado reaproveitam M2. Fases 7–9 permanecem indisponíveis.
8. Rerodar fases 1–3 após alteração de colisão e registro; medir recursos e latência de controle sob carga.
9. Executar rotas F04–F06 e playtest médio, registrando se o primeiro aviso explica a ação necessária.

## Entregáveis propostos

`src/entities/obstacles.js`, registro/configurações de famílias, colisões estáticas/móveis, três layouts/rotas e testes de ciclos/volumes. Extrações de scene/physics mantêm as regras de modularidade; UI recebe estado, não cálculo de trajetória.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M3-A01 | Cancela é previsível, congela na pausa e abre alternativa suficiente |
| M3-A02 | Pórtico aceita alinhamento físico correto e rejeita contato lateral/teto |
| M3-A03 | Vagão móvel não aparece sobre jogador e não atravessa o trem entre passos |
| M3-A04 | Fases 4–6 passam testes locais e C-01 a C-10 com todos os perfis |
| M3-A05 | Movimento/avisos usam tempo e seed da simulação; render corresponde ao volume |
| M3-A06 | Novas colisões não quebram 1–3 nem acumulam recursos |
| M3-A07 | Avisos, primeira apresentação e aumento de dificuldade aprovados no playtest |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M3-T01 / unitário | Cancela em cada fronteira de ciclo → step, pause, resume; rota alternativa | Estados conforme ciclo; nenhum fechamento durante pausa; rota válida sem atravessar cancela fechada | M3-A01 |
| M3-T02 / física | Trem alinhado, diagonal, lateral e aéreo → atravessar abertura/volumes | Abertura passa; contatos colidem; saltar não ignora teto; folga documentada | M3-A02 |
| M3-T03 / integração | Vagão cruzando com contato entre ticks → rodar em max speed e render 15/30/60 FPS | Colisão detectada pelo passo/varredura; nenhum spawn sobre o trem; via alternativa acessível | M3-A03 |
| M3-T04 / conteúdo | Fixtures 4–6 → todos os testes comuns/locais e perfis | Rotas completas e budgets respeitados; relatório por fase | M3-A04 |
| M3-T05 / instrumentação | Replay com móveis → comparar snapshots e meshes em ticks amostrados | Estado/ciclo iguais por seed; desvio visual-colisor dentro da tolerância definida para interpolação | M3-A05 |
| M3-T06 / regressão e recursos | Rodar fixtures 1–3 e 30 ciclos de 4–6 após aquecimento | Testes anteriores passam; recursos/timers estáveis segundo TC-08 | M3-A06 |
| M3-T07 / humano | Primeira exposição a cada família desktop/touch → pedir leitura da ação e observar tentativa | Jogador identifica o fechamento da cancela, o desvio e o alinhamento antes do risco; falhas de leitura geram ajuste e nova validação | M3-A07 |

## Gate de saída

As seis primeiras fases são jogáveis com progressão persistente; três famílias novas têm asserções de colisão/ciclo e evidência de legibilidade. Testar só sua animação não aceita M3. Roteiros devem reduzir encontros se os avisos e transições não couberem.
