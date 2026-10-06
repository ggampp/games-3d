# Fase 1 — Saída da estação

Status: planejada, sem implementação/testes executados. Entrega: M1 básico; M2 completo. Dependência: M1 e barreira estática de M2. Referências obrigatórias: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Aprender a mover os dois truques e alinhar a locomotiva sem exigir salto.

Briefing proposto: “Desvie das obras. Use A/D para a frente, setas para trás e W para alinhar.”

Objetivo opcional: Coletar três itens no chão durante uma passagem segura; opcional e sem prêmio adicional. Nenhuma pontuação mínima, compra, coleta ou IA é necessária para avançar.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-01` / `acrobatic-campaign-v1-01` |
| Dificuldade | Fácil |
| Comprimento / chegada | 600 m, posição de referência da locomotiva |
| Velocidade inicial → limite | 14 → 18 m/s; 50.4 → 64.8 km/h no HUD |
| Aceleração / troca de uma via | 0,35 m/s² / 0,28 s, sujeitos ao contrato M0 |
| Início / chegada seguros | 0–80 m / 520–600 m |
| Aviso / descanso desejados | ≥ 2,50 s; aplicar fórmula comum se exigir mais |
| Colisão / equipamento | Locomotiva e truques; seguidores visuais; perfil fixado antes da largada |

Todos os valores são candidatos de balanceamento. Medir tempo real, leitura de câmera e dificuldade humana antes do aceite. Dados de conteúdo não ativam o gerador infinito de perigos.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação e apresentação | Resposta esperada / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Nenhum perigo; trem começa C/C | Experimentar controles; aviso do primeiro encontro pode aparecer aqui |
| 90–120 | Obra em C | Barreira única em C; L e R livres | Mover frente e traseira para a mesma via lateral antes do contato |
| 180–210 | Obra em L | Barreira única em L; C/R livres | Retornar alinhado a C ou manter R |
| 270–300 | Obra em R | Barreira única em R; L/C livres | Escolher C ou L; não exigir mudança de duas vias sem orçamento |
| 360–390 | Corredor de itens | Itens em C; sem obstáculo obrigatório | Alinhar em C para coleta; pode ignorar |
| 450–480 | Revisão de desvio | Barreira em C com vias laterais livres | Repetir a habilidade; nenhuma família inédita |
| 520–600 | Chegada | Faixa final sem perigos | Atravessar vivo; nenhum requisito de pontos |

As faixas reservam espaço; não são colisores ocupando todo o intervalo. Determinar âncoras/volumes exatos na fixture e validar aviso, descanso e conexão com o encontro seguinte. Se o budget não couber, mover/remover encontro. Sem perigos nas zonas seguras, inclusive trajetória de objetos móveis.

## Tarefas de conteúdo

1. Construir layout exclusivamente com itens de solo e barreiras isoladas; não ativar PATTERNS aleatórios.
2. Adicionar aviso curto de desvio com demonstração de frente/traseira; dispensável em retry.
3. Confirmar mudança C/C→L/L ou R/R sem colisão com a barreira; considerar sobreposição durante a manobra.
4. Na versão M1, validar chegada com itens e pista livre; introduzir barreiras na entrega final M2.
5. Gravar fixture/rota, rodar todos os perfis e playtest com controle touch.
6. Validar seed/configuração e gravar `tests/fixtures/levels/level-01.json` e replay(s) em `tests/fixtures/replays/level-01.json` durante a implementação. Registrar inputs por tick, perfil e resultado esperado; não afirmar rota aprovada antes de executar.
7. Integrar briefing/HUD/resultado ao domínio da campanha e registrar evidência dos testes locais e comuns.

## Aceites específicos

Todos os aceites C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md) são obrigatórios além dos abaixo.

| ID | Resultado exigido |
| --- | --- |
| F01-A01 | Primeiros 80 m sem perigo e tutorial apresenta os três controles essenciais. |
| F01-A02 | Cada barreira bloqueia só uma via e deixa duas soluções alcançáveis. |
| F01-A03 | Barreira visual e volume físico correspondem. |
| F01-A04 | Chegada com score zero libera a fase 2 na campanha completa. |
| F01-A05 | Retry preserva compras e permite reaprender sem tutorial bloqueante. |
| F01-A06 | Primeiro playtest compreende desvio e alinhamento. |

## Casos de teste específicos

Testes de domínio/física usam fixtures e relógio injetado; casos de tela exigem navegador real; legibilidade exige playtest humano. São planos de teste, não resultados obtidos.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F01-T01 | Novo save/cyber → iniciar e avançar até 80 m. | Nenhum colisor perigoso na zona; A/D/setas/W correspondem ao texto; distância/progresso corretos. | F01-A01 |
| F01-T02 | Estado C/C → executar rotas L/L e R/R na primeira barreira. | Ambas passam; volumes não bloqueiam vias anunciadas livres. | F01-A02 |
| F01-T03 | Passar pelo centro de C e em folga lateral do mesmo obstáculo. | Centro causa uma derrota; folga passa; nenhum falso contato por seguidores. | F01-A03 |
| F01-T04 | Ignorar todos os itens → chegar; duplicar callback de chegada. | Uma conclusão; fase 2 liberada; sem crédito extra ou duplicação. | F01-A04 |
| F01-T05 | Após colisão, repetir com compra já salva. | Mesmo layout/seed e posição inicial; propriedade preservada; controles ativos apenas durante playing. | F01-A05 |
| F01-T06 | Sessão desktop e touch → perguntar como mover frente/traseira e evitar a barreira. | Jogador distingue os dois comandos; avisos legíveis; registrar dificuldades e ajustes. | F01-A06 |

Executar também TC-01 a TC-10 para esta fase. Repetir rotas com cyber e demais perfis habilitados, a 30/60/120 FPS, IA offline e teclado/touch. Comparar o layout após retry e garantir que derrota não dispara avanço.

## Gate de conclusão e evidência

Fixture final válida; rota(s) completa(s) executada(s); todos os aceites locais/comuns passam; playtest desktop/touch registrado. Guardar versão, seed, trem, inputs/ticks, resultado e imagens/clipe dos encontros, com asserções. Mudança de velocidade, volume, câmera ou layout exige revalidar os casos afetados.
