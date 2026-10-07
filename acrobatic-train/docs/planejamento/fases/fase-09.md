# Fase 9 — Desafio final

Status: implementada na M4 e validada automaticamente em 07/10/2026. [Resultados](../VALIDACAO_M4.md). Playtest humano pendente. Conteúdo e valores efetivos estão em src/levels/level-config.js e nas fixtures/replays. Entrega: M4. Dependência: Fase 8 e oito conclusões oficiais registradas; conquista de M4. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Demonstrar domínio de todo o repertório em sequência autorada estável e vencer a campanha.

Briefing: “Este é o desafio final. Use tudo o que aprendeu: desvie, alinhe, observe o tempo e escolha sua rota.”

Objetivo opcional: Completar a sequência e ganhar o troféu oficial; não exigir score ou porcentagem de sucesso. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-09` / `acrobatic-campaign-v1-09` |
| Dificuldade | Extrema, solucionável |
| Comprimento | 1500 m |
| Velocidade inicial → limite | 30 → 42 m/s; 108.0 → 151.2 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 1420–1500 m |
| Aviso / descanso desejados | ≥ 1,20 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

Sequência autorada, seed fixa e até duas famílias por encontro. Aviso candidato de 1,20 s, ampliado pela fórmula comum. Cada trecho usa habilidade previamente ensinada; não incluir obstáculo novo na final. Uma rota terrestre canônica com o trem gratuito é obrigatória; saltos seguem opcionais. A sequência não muda de forma aleatória após derrota, permitindo aprender. Dificuldade extrema não significa matematicamente impossível.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Preparação | Sem perigo | Ler objetivo final e retomar controles |
| 110–155 | Obras e reparo | Barreira C; gap L; R livre | Entrar R/R |
| 240–285 | Cancela e reparo | Cancela R; gap C; L livre | Preparar L/L a partir da saída anterior |
| 370–415 | Pórtico central e postes | Abertura C; postes fora da abertura | Entrar C/C alinhado |
| 500–545 | Rampa de escolha | Rampa R; gap L; C contínua | Rota terrestre C ou manobra R validada |
| 630–675 | Cruzamento | Vagão L→C; R contínua | Antecipar R/R |
| 760–805 | Cancela e reparo | Cancela L; gap C; R contínua | Manter R/R; não forçar janela da cancela |
| 890–935 | Abertura lateral | Pórtico L isolado | Mover R→C→L com orçamento de duas mudanças |
| 1020–1065 | Rampa e reparo | Rampa C; gap R; L contínua | Seguir L terrestre ou saltar C |
| 1150–1195 | Cruzamento espelhado | Vagão R→C; L contínua | Manter/preparar L/L depois do pouso opcional |
| 1280–1320 | Última abertura | Pórtico C; nenhuma novidade | Alinhar C/C e preparar chegada |
| 1420–1500 | Vitória | Sem perigos; troféu não é colisor | Chegar vivo; encerrar campanha uma vez |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Autorizar cada encontro, rota de entrada/saída e cronograma; impedir seleção infinita de PATTERNS na final.
2. Validar rota canônica terrestre e variante com salto; calcular o maior tempo de mudança/pouso entre encontros.
3. Garantir aviso ampliado para R→L antes do pórtico; 1,20 s é mínimo, não autorização para compressão.
4. Integrar vitória final e troféu idempotente somente quando nove conclusões oficiais estiverem válidas.
5. Playtest de precisão, registro de derrotas e revalidação após ajuste; não declarar taxa populacional de sucesso.
6. Escrever fixture `tests/fixtures/levels/level-09.json` e replay(s) `tests/fixtures/replays/level-09.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar vitória/troféu e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F09-A01 | Final usa só famílias ensinadas e layout estável após retry. |
| F09-A02 | Rota canônica com cyber chega viva sem compra/salto/IA. |
| F09-A03 | R→L e pousos opcionais cabem no orçamento de reação. |
| F09-A04 | Colisão no passo final impede vitória e troféu. |
| F09-A05 | Vitória concede um troféu persistente após nove fases oficiais. |
| F09-A06 | Tela final e playtest preservam navegação/clareza. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F09-T01 | Comparar configurações das nove fases e hashes de 10 reinícios da final. | Sem família inédita; seed/layout idênticos; no máximo duas famílias perigosas por encontro. | F09-A01 |
| F09-T02 | Oito conclusões oficiais/cyber/API offline → executar replay terrestre. | Chegada válida com controle real; nenhum requisito de pontos; nenhuma necessidade de modelo pago. | F09-A02 |
| F09-T03 | Rodar trechos 760–935 e 1020–1195 na velocidade máxima, terrestre e aéreo. | Transições alcançáveis; aviso aumentado se necessário; nada exige controle indisponível. | F09-A03 |
| F09-T04 | Fixture antes da chegada com contato no mesmo tick → avançar. | Derrota única; nenhum campaignCompleted/troféu; progresso não recebe conclusão falsa. | F09-A04 |
| F09-T05 | Concluir 9, duplicar evento, reload, concluir novamente; variante com histórico incompleto. | Um campaign-9-complete no histórico válido; sem duplicação; histórico incompleto não recebe troféu. | F09-A05 |
| F09-T06 | Vitória com mute/movimento reduzido → usar teclado/touch para mapa/infinito/retry. | Foco correto, áudio respeita mute, animação reduzida; causa de derrota compreensível e dificuldade registrada. | F09-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
