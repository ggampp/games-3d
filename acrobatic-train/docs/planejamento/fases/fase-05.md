# Fase 5 — Ponte de manobras

Status: implementada na M3 e validada automaticamente em 07/10/2026. [Resultados](../VALIDACAO_M3.md). Playtest humano pendente. Conteúdo e valores efetivos estão em src/levels/level-config.js e nas fixtures/replays. Entrega: M3. Dependência: Fase 4; pórtico e colisão tridimensional de M3. Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md), [índice](../README.md).

## Objetivo e experiência

Alinhar os dois truques numa abertura real e planejar a via correta antes do pórtico.

Briefing: “O pórtico deixa uma passagem. Alinhe frente e traseira na via indicada.”

Objetivo opcional: Cruzar todos os pórticos sem postura diagonal; métrica opcional. Chegada viva é suficiente; nenhum score, trem comprado ou API é obrigatório.

## Configuração inicial

| Campo | Proposta |
| --- | --- |
| ID / seed | `level-05` / `acrobatic-campaign-v1-05` |
| Dificuldade | Média |
| Comprimento | 1100 m |
| Velocidade inicial → limite | 22 → 30 m/s; 79.2 → 108.0 km/h no HUD |
| Aceleração / troca de via | 0,35 m/s² / 0,28 s; confirmar contrato M0 |
| Zonas seguras | Início 0–80 m; final 1020–1100 m |
| Aviso / descanso desejados | ≥ 2,00 s; ampliar pelo número de mudanças/pouso conforme fórmula comum |
| Colisão/equipamento | Locomotiva/truques; seguidores visuais; perfil fixado no briefing |

Valores candidatos de playtest. Confirmar orçamento de câmera e avisos na velocidade máxima, não somente na velocidade inicial.

## Regra da mecânica nova

Pórtico usa volumes laterais e teto com abertura suficiente para o envelope normalizado da locomotiva. A indicação aponta a abertura, não uma autorização de passagem. A fixture registra largura, altura e folga; cruzar diagonal pode tocar lateral. Nesta fase, não há rampa dentro do envelope do pórtico e nenhum salto é obrigatório. Via contínua não deve parecer ponte quebrada.

## Roteiro de encontros

| Envelope longitudinal | Encontro | Ocupação | Resposta / alternativa |
| --- | --- | --- | --- |
| 0–80 | Aquecimento | Sem perigo | Explicar forma/seta da abertura |
| 120–160 | Primeira abertura | Abertura em C; isolada | Entrar C/C e atravessar |
| 300–340 | Abertura lateral | Abertura em R; aviso antecipado | Mover os dois truques para R/R |
| 480–525 | Postes de revisão | Entre vias; C alinhada livre | Evitar diagonal; retornar à via indicada |
| 680–725 | Abertura em L | Sem outro perigo no envelope | Mudar para L com budget de duas mudanças se necessário |
| 890–935 | Revisão combinada | Gap em R antes de pórtico com abertura C; envelopes separados | Escolher C e alinhar; medir recuperação entre os dois |
| 1020–1100 | Chegada | Sem perigo | Liberar fase 6 |

Envelope não é colisor contínuo: a fixture define posição/tamanho/duração exatos. Validar saídas/entradas de ambos os truques e todas as fronteiras. Se espaço ou budget falhar, ajustar posições/remover encontro; não encurtar o aviso. Perigos e trajetórias não invadem as zonas seguras.

## Tarefas de conteúdo

1. Definir abertura/volumes da ponte/pórtico sem associar derrota apenas ao nome da via.
2. Demonstrar comando W e alinhamento explícito de frente/traseira no primeiro encontro.
3. Calcular caminho de saída da abertura R para L; se duas mudanças não couberem, aumentar intervalo.
4. Testar yaw diagonal, teto e folga com todos os perfis; render correspondente ao colisor.
5. Gravar rota de referência alinhada e fixtures de colisão por lateral/teto.
6. Escrever fixture `tests/fixtures/levels/level-05.json` e replay(s) `tests/fixtures/replays/level-05.json` na implementação; inputs por tick, perfil, versão e resultado esperado.
7. Rodar rotas/colisões, integrar resultado/desbloqueio e registrar playtest da novidade antes das combinações.

## Aceites específicos

Obrigatórios também todos C-01 a C-10 de [CONTRATOS.md](../CONTRATOS.md).

| ID | Resultado exigido |
| --- | --- |
| F05-A01 | Abertura aceita o trem gratuito e todos os perfis normalizados. |
| F05-A02 | Diagonal não atravessa uma lateral por checagem simplificada de via. |
| F05-A03 | Contato com teto é tratado pela altura real. |
| F05-A04 | Transição R→L tem tempo para alinhar. |
| F05-A05 | Reparo e pórtico combinados mantêm rota C. |
| F05-A06 | Chegada libera 6 e leitura do pórtico é compreendida. |

## Casos de teste específicos

Plano de execução futura: simulação/física com relógio injetado; E2E para apresentação/controles; humano para legibilidade.

| ID | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| F05-T01 | Atravessar cada abertura alinhado com todos os perfis. | Passagem sem contato; folga visual/física documentada; composição longa é visual. | F05-A01 |
| F05-T02 | Frente na abertura/traseira fora → atravessar o pórtico. | Colisão com a lateral real; ter frente correta não libera o restante do volume. | F05-A02 |
| F05-T03 | Fixture de salto que cruza o teto e variante abaixo dele. | Contato de teto derrota; abaixo passa se dentro da abertura; não ignorar pórtico em jump.on. | F05-A03 |
| F05-T04 | Saída real da abertura lateral → replay de duas mudanças e alinhamento. | Entrada L/L alcançada antes do primeiro contato; aviso/reação conforme orçamento. | F05-A04 |
| F05-T05 | Executar último encontro ignorando itens; inspecionar fronteira de volumes. | C contínua e abertura segura; nenhum bloqueio por sobreposição não prevista. | F05-A05 |
| F05-T06 | Concluir/reload e playtest da primeira abertura. | 6 liberada quando entregue; jogador identifica abertura e necessidade de alinhamento sem depender só da cor. | F05-A06 |

Executar TC-01 a TC-10 com esta fase, todos os perfis normalizados e render 30/60/120 FPS. Desligar IA e efeitos para confirmar que layout/conclusão não dependem deles; retry e derrota não concedem avanço indevido.

## Gate de conclusão

Configuração e rotas executadas; novidade física testada isoladamente e na combinação; aceites locais/comuns passando; playtest desktop/touch documentado. Guardar versões, seed, perfil, eventos/ticks, resultados e vídeo/imagens dos avisos/contatos. Qualquer mudança de ciclo, volume, velocidade ou layout exige rerodar os casos afetados.
