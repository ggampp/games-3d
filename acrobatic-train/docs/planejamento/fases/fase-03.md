# Fase 3 — Primeiro voo

Status: planejada, sem implementação/testes executados. Entrega: M2. Dependência: Fase 2; rampas/pouso e coleta por altura corrigida. Referências obrigatórias: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Experimentar salto e pouso; reconhecer que postura diagonal muda a manobra.

Briefing proposto: “Entre na rampa para voar. Alinhado faz backflip; diagonal faz giro. Os anéis são opcionais.”

Objetivo opcional: Pousar uma manobra e coletar um item aéreo; métrica opcional, sem bloquear chegada. Nenhuma pontuação mínima, compra, coleta ou IA é necessária para avançar.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-03` / `acrobatic-campaign-v1-03` |
| Dificuldade | Fácil |
| Comprimento / chegada | 850 m, posição de referência da locomotiva |
| Velocidade inicial → limite | 18 → 24 m/s; 64.8 → 86.4 km/h no HUD |
| Aceleração / troca de uma via | 0,35 m/s² / 0,28 s, sujeitos ao contrato M0 |
| Início / chegada seguros | 0–80 m / 770–850 m |
| Aviso / descanso desejados | ≥ 2,50 s; aplicar fórmula comum se exigir mais |
| Colisão / equipamento | Locomotiva e truques; seguidores visuais; perfil fixado antes da largada |

Todos os valores são candidatos de balanceamento. Medir tempo real, leitura de câmera e dificuldade humana antes do aceite. Dados de conteúdo não ativam o gerador infinito de perigos.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação e apresentação | Resposta esperada / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | C/C; sem perigo | Relembrar desvio/alinhamento |
| 110–150 | Rampa alinhada | Rampa em C, solo lateral seguro e pouso livre | Entrar C/C para backflip ou usar L/R para evitar o salto |
| 250–290 | Postes isolados | Postes entre vias; via central alinhada livre | Não ficar diagonal no corredor; aprender colisão lateral |
| 390–435 | Rampa diagonal | Rampa em R; espaço lateral/pouso validado para giro | Usar frente na rampa e postura permitida para giro, ou rota terrestre alternativa |
| 550–590 | Coleta aérea opcional | Rampa em C e anel no ponto real da trajetória | Subir para coletar; passar em solo não coleta o anel |
| 680–720 | Revisão | Rampa opcional em L; restante contínuo | Escolher voar ou desviar; pouso termina antes da zona final |
| 770–850 | Chegada | Sem perigo ou pouso obrigatório pendente | Chegar vivo e liberar 4 |

As faixas reservam espaço; não são colisores ocupando todo o intervalo. Determinar âncoras/volumes exatos na fixture e validar aviso, descanso e conexão com o encontro seguinte. Se o budget não couber, mover/remover encontro. Sem perigos nas zonas seguras, inclusive trajetória de objetos móveis.

## Tarefas de conteúdo

1. Calcular trajetória com gravidade/velocidade/perfil em vez de assumir que anéis em y=4/8 sempre são atingíveis.
2. Posicionar itens a partir de ponto da trajetória aprovada, dentro do envelope visual da locomotiva.
3. Manter alternativa terrestre em todos os encontros de rampa; nenhum prêmio obrigatório para desbloqueio.
4. Validar postura alinhada/diagonal e região de pouso, sem inserir perigo antes de recuperar controle.
5. Criar replay com saltos e replay sem saltos; medir reação e efeitos de câmera em mobile.
6. Validar seed/configuração e gravar `tests/fixtures/levels/level-03.json` e replay(s) em `tests/fixtures/replays/level-03.json` durante a implementação. Registrar inputs por tick, perfil e resultado esperado; não afirmar rota aprovada antes de executar.
7. Integrar briefing/HUD/resultado ao domínio da campanha e registrar evidência dos testes locais e comuns.

## Aceites específicos

Todos os aceites C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md) são obrigatórios além dos abaixo.

| ID | Resultado exigido |
| --- | --- |
| F03-A01 | Cada rampa mantém alternativa terrestre e uma região de pouso segura. |
| F03-A02 | Postura alinhada e diagonal produzem a manobra anunciada. |
| F03-A03 | Item aéreo requer altura e só é coletado uma vez. |
| F03-A04 | Região de pouso respeita perfil e aviso seguinte. |
| F03-A05 | IA offline ou resposta atrasada não determina conclusão. |
| F03-A06 | Completar libera 4; efeitos de salto não escondem aviso. |

## Casos de teste específicos

Testes de domínio/física usam fixtures e relógio injetado; casos de tela exigem navegador real; legibilidade exige playtest humano. São planos de teste, não resultados obtidos.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F03-T01 | Executar replay só por vias sem rampas; depois replay de salto. | Ambos chegam; pouso sem contato forçado ou input inalcançável. | F03-A01 |
| F03-T02 | Mesmo perfil → entrar alinhado e na postura diagonal válida. | Backflip e giro distintos; ambos retornam a estado controlável; HUD descreve a manobra correta. | F03-A02 |
| F03-T03 | Passar sob anel, depois cruzar seu volume em salto; repetir verificação. | Zero coleta no solo; um evento de coleta em contato aéreo; score/saldo sem duplicação. | F03-A03 |
| F03-T04 | Replay de cada salto em max speed com todos os perfis normalizados. | Pouso antes do próximo perigo e com tempo de reação; rota válida de saída. | F03-A04 |
| F03-T05 | Bloquear API e resolver resposta após retry. | Fase jogável/concluível sem API; nova tentativa sem bônus/modal antigo. | F03-A05 |
| F03-T06 | Chegar por ambos os replays, reload e playtest mobile. | 4 liberada quando entregue em M3; câmera preserva leitura; dados persistidos. | F03-A06 |

Executar também TC-01 a TC-10 para esta fase. Repetir rotas com cyber e demais perfis habilitados, a 30/60/120 FPS, IA offline e teclado/touch. Comparar o layout após retry e garantir que derrota não dispara avanço.

## Gate de conclusão e evidência

Fixture final válida; rota(s) completa(s) executada(s); todos os aceites locais/comuns passam; playtest desktop/touch registrado. Guardar versão, seed, trem, inputs/ticks, resultado e imagens/clipe dos encontros, com asserções. Mudança de velocidade, volume, câmera ou layout exige revalidar os casos afetados.
