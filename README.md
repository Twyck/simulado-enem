# Simulado ENEM

PWA para fazer as provas oficiais do ENEM (2017–2025, 1º e 2º dia, caderno Azul) no próprio PDF do INEP:
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

## Tipos de prova

- **Prova completa**: as 90 questões de um dia, no tempo oficial (ou sem a hora da redação, ou sem limite).
- **Uma área**: só as 45 questões de uma área, no caderno oficial (só as páginas dela), com nota TRI da área.
- **Redação**: a proposta oficial do ano (as páginas do próprio caderno), folha de 30 linhas e autoavaliação
  pelas 5 competências. No 1º dia completo, a folha também abre no botão Redação, no mesmo tempo de prova.
  O app não corrige redação: a nota é a que você se dá, e ela entra no SISU como autoavaliação.
- **Treino por matéria**: abaixo.

## Treino por matéria

Em "Nova prova", escolha **Treino por matéria**: matéria, assunto (opcional), anos e quantidade. O app mostra só
essas questões, recortadas dos cadernos oficiais, e a análise mostra os assuntos fortes e fracos.

## Simulação do SISU

Em **Simular SISU**, o app pega a nota TRI de cada área da sua prova completa mais recente (você pode digitar outra),
você digita a redação e escolhe se concorre pelas cotas da Lei 12.711. Ele aplica os pesos e as notas mínimas de
cada curso e compara com a nota de corte real do SISU 2025: em quais cursos você passaria, quais ficaram perto
(até 20 pontos) e quais exigem nota mínima que você não tem.

## Caderno de erros com revisão espaçada

Cada questão errada (em prova ou treino) entra no caderno e volta no dia seguinte; acertou, volta em 3 dias e
depois em 7; acertando a terceira revisão seguida, sai do caderno. Tudo é calculado a partir das provas entregues,
então o backup já leva o caderno.

## Meta de curso

Na simulação do SISU, a estrela ★ escolhe um curso como meta. A tela de evolução mostra a sua nota naquele curso
(com os pesos dele), quanto falta para o corte, quanto 10 pontos em cada área sobem a média e quanto as questões
fáceis erradas na última prova teriam rendido.

## Backup

As provas ficam só no navegador. Em "Seus dados", **Baixar backup** gera um arquivo `.json` com tudo (respostas,
anotações, tempos); **Restaurar backup** junta esse arquivo ao que já existe no aparelho.

## Como usar na prova

- **Clique na letra** (A–E) dentro do PDF para marcar; clique de novo para desmarcar.
- **Clique direito / toque longo** risca a alternativa (ou use a ferramenta de riscar).
- Caneta, marca-texto e borracha na barra de cima; zoom com lupa.
- Teclado: `A`–`E` marcam a questão em foco, `J`/`K` vão para a próxima/anterior.
- O botão com o olho riscado (ou a tecla `H`) oculta a barra de cima: some o tempo e a contagem de questões.
  O botão "Mostrar barra", no canto, traz tudo de volta.
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
- `data/sisu/2025.json` — os 6.863 cursos do SISU 2025 com pesos, notas mínimas e nota de corte de cada modalidade
  no fim das inscrições, lidos da API oficial do SISU (coletados em github.com/maiakanegae/sisu-data;
  `python3 scripts/build_sisu.py 2025`). As ações afirmativas próprias de cada instituição e os bônus regionais ficam de fora.
- `data/acertos.json` — quantos candidatos marcaram cada alternativa de cada questão do caderno Azul, lido das
  respostas de todos os participantes nos microdados (`scripts/build_acertos.py`, `scripts/junta_microdados.py`).
  Aparece na revisão e no resultado ("41% dos candidatos acertaram", alternativa errada mais marcada).
- `data/percentis.json` — distribuição das notas oficiais de todos os participantes de cada ano
  (2,2 a 3,5 milhões por área), lida dos microdados por `scripts/build_percentis.py`.

### Nota TRI

`js/tri.js` usa o mesmo modelo do INEP: logístico de 3 parâmetros (D = 1), proficiência estimada por EAP
com priori normal padrão, e uma transformação linear por área para a escala do ENEM. As constantes dessa
transformação foram ajustadas com respostas e notas oficiais dos microdados e são as mesmas em todos os anos.
`scripts/check_tri.mjs` confere o código do app contra participantes reais: em cerca de 250 mil notas de 2017 a 2025,
a diferença média é de 0,03 ponto. A exceção são cinco provas em que os parâmetros publicados pelo INEP não
reproduzem as notas oficiais (diferença média de 11 a 63 pontos em todas as cores de caderno): Ciências Humanas,
Ciências da Natureza e Matemática de 2017, Ciências da Natureza de 2018 e Matemática de 2019. Nelas o app mostra
só os acertos (`NAO_REPRODUZ` em `scripts/build_itens.py`).

Em 2017 o INEP numera os itens dentro de cada área (`scripts/inep_itens.py`), e o gabarito em PDF não está mais
no site: ele sai do `ITENS_PROVA_2017.csv` e foi conferido com o gabarito gravado nos dados de cada participante.
Até 2019 os cadernos ficam em outro endereço do INEP (`INEP_ANTIGO` em `js/data.js`).

Questões anuladas ou retiradas do cálculo pelo INEP ficam de fora; em branco conta como erro.

Para adicionar um ano: coloque os PDFs em `provas/` com o nome `ANO_PV_impresso_D1_CD1.pdf` (e o gabarito
`ANO_GB_…`), rode `npm run dados`; quando saírem os microdados, `python3 scripts/build_itens.py .`,
`python3 scripts/build_acertos.py ANO saida/ANO.json saida/pct_ANO.json` e `python3 scripts/junta_microdados.py . saida`;
classifique as matérias (`node scripts/textos_pdf.mjs . textos.json ANO`, lista em `scripts/assuntos/`,
`python3 scripts/build_assuntos.py .`), confira a TRI com `scripts/check_tri.mjs` e inclua o ano em `YEARS`
(`js/data.js` e `sw.js`).

## Publicado

https://twyck.github.io/simulado-enem/ — GitHub Pages, publicado a partir da branch `main`.
Cada pessoa que abre o link começa do zero: as provas, anotações e notas ficam só no navegador dela.
No celular, "Adicionar à tela de início" instala o app e ele passa a funcionar sem internet.
