# GDD — Pequeno Reino

gameId: `gm_mt1vr3w4_2bee78cb`
genre: **Builder / sim** (`city-builder`)
art: **Paper / diorama**
idioma: PT-BR

## 1. Vision

Você é o cartógrafo-rei de um bolsão lusófono. Cada carta é um pedaço de chão, um telhado ou um aldeão. Posar hexágonos vizinhos faz o reino respirar.

## 2. Player fantasy

MDA: Expression (o reino é seu), Discovery (biomas e cadeias), Submission (ritmo zen). Sem combate. Cidades arrumadas e caos medieval são ambos válidos.

## 3. Core loop

- Verb: **posar um hexágono**
- Objective: cumprir 2–3 missões da fase (população, cadeia, harmonia)
- Fail: suave — baralho vazio sem missões = “O reino adormeceu”, retry
- Camera: órbita isométrica sobre diorama

Cada turno: mão de 3 cartas → escolher 1 → preview no hex adjacente → posar → cadeias / pontos / aldeões → refill.

## 4. Mechanics

- Grade axial hex (q, r), 6 vizinhos
- Baralho da fase + mão 3 + pacote opcional (custa 1 pão)
- Produção por adjacência (não por tick de frame)
- Três eixos: Natureza, Povo, Água
- Missões relax + tiles desbloqueáveis
- 5 fases sazonais / bioma

## 5. Dynamics

Layout gera cadeias (roça–engenho–padaria). Clusters do mesmo bioma pontuam. Rios pedem continuidade. O jogador escolhe ordem vs. bagunça feliz.

## 6. Progression / content

1. Primavera na Clareira — tutorial, desbloqueia Engenho
2. Verão na Mata — Cabana do Mateiro
3. Outono no Rio — Cais
4. Inverno na Serra — Pedreira
5. O Reino Inteiro — sandbox, metas opcionais, álbum

## 7. Art / audio

Hexes procedurais, contato de sombra, céu creme, nuvens lentas. SFX sintetizados (sem ElevenLabs). UI overlay HTML.

## 8. Scope / MVP / risks

MVP = loop jogável + 5 fases + tela inicial. Risco: parecer clone visual do comercial — nomes, paleta e meshes são originais. Não afirmar premium sem scorecard + canvas.
