# Fase 2 — Trilhos em reparo

Status: planejada, sem implementação/testes executados. Entrega: M2. Dependência: Fase 1 concluída; configuração de gaps e validador de rota. Referências obrigatórias: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Reconhecer um trilho rompido e escolher uma via contínua para os dois truques.

Briefing proposto: “Trilhos rompidos derrubam o trem. Procure a via contínua e alinhe antes da lacuna.”

Objetivo opcional: Coletar a linha de itens que indica uma via segura; sem obrigação de coleta. Nenhuma pontuação mínima, compra, coleta ou IA é necessária para avançar.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-02` / `acrobatic-campaign-v1-02` |
| Dificuldade | Fácil |
| Comprimento / chegada | 750 m, posição de referência da locomotiva |
| Velocidade inicial → limite | 16 → 21 m/s; 57.6 → 75.6 km/h no HUD |
| Aceleração / troca de uma via | 0,35 m/s² / 0,28 s, sujeitos ao contrato M0 |
| Início / chegada seguros | 0–80 m / 670–750 m |
| Aviso / descanso desejados | ≥ 2,50 s; aplicar fórmula comum se exigir mais |
| Colisão / equipamento | Locomotiva e truques; seguidores visuais; perfil fixado antes da largada |

Todos os valores são candidatos de balanceamento. Medir tempo real, leitura de câmera e dificuldade humana antes do aceite. Dados de conteúdo não ativam o gerador infinito de perigos.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação e apresentação | Resposta esperada / alternativa |
| --- | --- | --- | --- |
| 0–80 | Retomada segura | Sem perigo; C/C | Relembrar os controles |
| 100–130 | Primeira lacuna | Gap de 8 m em C; L/R contínuas | Desviar ambos os truques; aviso textual de trilho rompido |
| 220–250 | Lacuna lateral | Gap de 10 m em L; C/R contínuas | Escolher/manter uma via contínua |
| 350–390 | Reparo duplo | Gaps de 8 m em L e C; R contínua | Entrar em R/R com aviso calculado para a entrada real |
| 490–520 | Retorno ao centro | Gap de 10 m em R; L/C contínuas | Alinhar em C ou L antes do contato |
| 600–630 | Revisão | Gap de 12 m em C; L/R contínuas | Repetir desvio; nenhum salto obrigatório |
| 670–750 | Chegada | Sem perigo | Chegar vivo e liberar 3 |

As faixas reservam espaço; não são colisores ocupando todo o intervalo. Determinar âncoras/volumes exatos na fixture e validar aviso, descanso e conexão com o encontro seguinte. Se o budget não couber, mover/remover encontro. Sem perigos nas zonas seguras, inclusive trajetória de objetos móveis.

## Tarefas de conteúdo

1. Criar geometria de lacuna consistente com colisão e retirar dormentes/trilho no envelope real.
2. Usar itens como pista opcional, sem depender somente deles para comunicar a via segura.
3. Autorizar gap duplo apenas depois de validar entrada alcançável em R para ambos os truques.
4. Testar cada truque individualmente: frente livre não torna traseira segura automaticamente.
5. Gravar rotas com desvio, incluindo transições de segmento e retorno ao centro.
6. Validar seed/configuração e gravar `tests/fixtures/levels/level-02.json` e replay(s) em `tests/fixtures/replays/level-02.json` durante a implementação. Registrar inputs por tick, perfil e resultado esperado; não afirmar rota aprovada antes de executar.
7. Integrar briefing/HUD/resultado ao domínio da campanha e registrar evidência dos testes locais e comuns.

## Aceites específicos

Todos os aceites C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md) são obrigatórios além dos abaixo.

| ID | Resultado exigido |
| --- | --- |
| F02-A01 | Fase bloqueada até concluir 1 e sem salto obrigatório na rota segura. |
| F02-A02 | Ruptura visual coincide com perda de suporte de cada truque. |
| F02-A03 | Gap duplo mantém R alcançável desde o encontro anterior. |
| F02-A04 | Itens não induzem rota sem trilho nem geram coleta indevida. |
| F02-A05 | Ausência de trilho funciona em fronteira de segmento. |
| F02-A06 | Vitória/retry/save mantêm progressão correta. |

## Casos de teste específicos

Testes de domínio/física usam fixtures e relógio injetado; casos de tela exigem navegador real; legibilidade exige playtest humano. São planos de teste, não resultados obtidos.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F02-T01 | Save sem 1 → solicitar 2; depois save com 1 → rota sem rampas. | Entrada inicial recusada; rota terrestre conclui após desbloqueio. | F02-A01 |
| F02-T02 | Colocar só dianteiro ou só traseiro sobre gap com altura abaixo de SAFE_LIFT. | Derrota em cada variante; duas condições reportadas com motivo coerente. | F02-A02 |
| F02-T03 | Reproduzir saída do encontro de 220–250 → preparar R/R no reparo duplo. | Ambos os truques em R antes do contato; orçamento de reação passa na velocidade máxima. | F02-A03 |
| F02-T04 | Inspecionar conteúdo e seguir linha de coleta sem saltar. | Linha segue volume seguro; deixar itens não impede conclusão. | F02-A04 |
| F02-T05 | Fixture de gap cortando fronteira geométrica → atravessar via livre e via quebrada. | Via livre continua; quebrada colide sem buraco de verificação. | F02-A05 |
| F02-T06 | Concluir 2, reload, perder na repetição e voltar ao mapa. | 3 permanece liberada; derrota não conclui; compras/score da tentativa tratados corretamente. | F02-A06 |

Executar também TC-01 a TC-10 para esta fase. Repetir rotas com cyber e demais perfis habilitados, a 30/60/120 FPS, IA offline e teclado/touch. Comparar o layout após retry e garantir que derrota não dispara avanço.

## Gate de conclusão e evidência

Fixture final válida; rota(s) completa(s) executada(s); todos os aceites locais/comuns passam; playtest desktop/touch registrado. Guardar versão, seed, trem, inputs/ticks, resultado e imagens/clipe dos encontros, com asserções. Mudança de velocidade, volume, câmera ou layout exige revalidar os casos afetados.
