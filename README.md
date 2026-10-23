# Simulado ENEM

PWA para fazer as provas oficiais do ENEM (2021–2025, 1º e 2º dia, caderno Azul) no próprio PDF do INEP:
você clica nas letras impressas para marcar, risca alternativas, escreve com caneta e marca-texto, com
cronômetro no topo. Ao entregar, mostra acertos por área e por matéria, tempo em cada questão, ritmo de prova
e as questões em que você teve mais e menos dificuldade.

## Rodar

```bash
npm install
npm run vendor
npm start
```

Abra http://localhost:5173. Tudo fica salvo no navegador (IndexedDB), inclusive provas em andamento.

## Treino por matéria

Em "Nova prova", escolha **Treino por matéria**: matéria, assunto (opcional), anos e quantidade. O app mostra só
essas questões, recortadas dos cadernos oficiais, e a análise mostra os assuntos fortes e fracos.

## Backup

As provas ficam só no navegador. Em "Seus dados", **Baixar backup** gera um arquivo `.json` com tudo (respostas,
anotações, tempos); **Restaurar backup** junta esse arquivo ao que já existe no aparelho.

## Como usar na prova

- **Clique na letra** (A–E) dentro do PDF para marcar; clique de novo para desmarcar.
- **Clique direito / toque longo** risca a alternativa (ou use a ferramenta de riscar).
- Caneta, marca-texto e borracha na barra de cima; zoom com lupa.
- Teclado: `A`–`E` marcam a questão em foco, `J`/`K` vão para a próxima/anterior.
- O tempo por questão vai para a questão "em foco": a que você clicou ou marcou por último
  (ao marcar, o foco passa para a próxima). Se ela sair da tela, o foco vai para a primeira questão visível.

## Dados

- `provas/` — PDFs oficiais do INEP (cadernos e gabaritos). Se faltar algum, o app baixa direto de
  `download.inep.gov.br`.
- `data/gabaritos.json` — extraído dos PDFs de gabarito (`scripts/parse_gabaritos.py`).
- `data/layout/*.json` — posição de cada questão e alternativa no PDF (`scripts/build_layout.mjs`).
- `data/itens.json` — parâmetros TRI (a, b, c) e habilidade de cada questão do caderno Azul, tirados de
  `ITENS_PROVA_<ano>.csv` dos microdados do INEP (`scripts/build_itens.py`, que lê só esse arquivo de
  dentro do zip via HTTP Range, sem baixar os ~600 MB).
- `data/habilidades.json` — as 30 habilidades de cada área da Matriz de Referência (`scripts/parse_matriz.py`).
- `data/assuntos.json` — matéria e assunto de cada uma das 925 questões, classificados lendo o enunciado
  (lista em `scripts/assuntos/*.out`, gerada com `scripts/build_assuntos.py`; textos via OCR com `scripts/ocr.swift`).
- `data/layout/*.json` também traz o recorte de cada questão (`parts`), usado no treino por matéria.
- `data/percentis.json` — distribuição das notas oficiais de todos os participantes de cada ano
  (2,2 a 3,5 milhões por área), lida dos microdados por `scripts/build_percentis.py`.

### Nota TRI

`js/tri.js` usa o mesmo modelo do INEP: logístico de 3 parâmetros (D = 1), proficiência estimada por EAP
com priori normal padrão, e uma transformação linear por área para a escala do ENEM. As constantes dessa
transformação foram ajustadas com respostas e notas oficiais dos microdados e são as mesmas em todos os anos.
`scripts/check_tri.mjs` confere o código do app contra participantes reais: em ~150 mil notas de 2021 a 2025,
a diferença média é de 0,03 ponto. Questões anuladas ou retiradas do cálculo pelo INEP ficam de fora;
em branco conta como erro.

Para adicionar um ano: coloque os PDFs em `provas/` com o nome do INEP, rode `npm run dados`,
`python3 scripts/build_itens.py .` (quando saírem os microdados), refaça a classificação de matérias e inclua o ano em `YEARS` (`js/data.js` e `sw.js`).

## Publicado

https://twyck.github.io/simulado-enem/ — GitHub Pages, publicado a partir da branch `main`.
Cada pessoa que abre o link começa do zero: as provas, anotações e notas ficam só no navegador dela.
No celular, "Adicionar à tela de início" instala o app e ele passa a funcionar sem internet.
