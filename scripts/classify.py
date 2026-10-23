"""Classifica cada questão em uma matéria (estimativa por palavras-chave) → data/disciplinas.json.
Uso: python3 classify.py <app> <textos.json>"""
import json, re, sys, unicodedata
from collections import Counter
from pathlib import Path

app, textos = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text())

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

# prefixos de palavras (sem acento), separados por vírgula
KW = {
    'LC': {
        'Literatura': 'romance*2, poema*2, poeta*2, poesia*2, poetic, verso*2, estrofe*2, soneto*2, conto, crônica, cronica, narrador*2, narrativ, personagem, eu lirico*2, literari*2, modernis, romantis, barroc, parnasian, simbolis, arcadis, realis, naturalis, machado, drummond, bandeira, clarice, guimaraes, rosa, graciliano, cecilia, meireles, vinicius, alencar, euclides, lobato, rachel, queiroz, trecho do romance, obra literaria, escritor, escritora, ficcao, ficcional',
        'Artes': 'arte, artista, pintura, pintor, pintora, escultura, obra de arte, exposicao, museu, instalacao, artistic, tela, fotografia, performance, teatro, cinema, filme, grafite, vanguard, cubis, surrealis, impressionis, bienal, galeria, estetic, arquitetura, cenico',
        'Educação Física': 'esporte*2, esportiv*2, atleta*2, atletas*2, futebol*2, ginastica*2, exercicio*0.5, atividade fisica*2, corpo*0.5, corporal*0.5, capoeira*2, luta*0.5, lutas*2, olimpi*2, jogos*0.5, danca*0.5, jogo*0.5, competic*0.5, treino*0.5, treinamento*0.5, sedentaris*2, saude*0.5, muscul*0.5, paralimp*2, skate*2, basquete, volei, handebol',
        'Língua Portuguesa': 'variacao, linguistic, variedade, norma-padrao, norma padrao, gramatic, sintatic, verbo, pronome, conectivo, coesao, coerencia, concordancia, regencia, pontuacao, vocabul, neologismo, sufixo, prefixo, palavra, termo, expressao, linguagem, lingua portuguesa, falante, dialeto, sotaque, oralidade, registro, formal, informal, genero textual, funcao da linguagem, metalinguagem',
    },
    'CH': {
        'História': 'seculo*2, imperio*2, imperial, colonia, colonial*2, coloniza, revolucao*2, guerra, ditadura*2, regime militar, republica, escravid*2, escraviza*2, escravo, abolic, medieval*2, feudal*2, idade media, renascimento, iluminis, absolutis, monarquia, rei, rainha, reino, vargas, getulio, era vargas, independencia, inconfid, cabanagem, canudos, antiguidade, grecia, romano, roma, faraó, egito, revolta, quilombo, bandeirante, jesuit, sesmaria, mercantilis, guerra fria, nazis, fascis, totalitar, holocausto, cruzada, reforma protestante, 1500, 1600, 1700, 1800, 1822, 1888, 1889, 1930, 1937, 1964, 1968, 1985, historiador*2, historic',
        'Geografia': 'clima, climatic, relevo, solo, solos, erosao, urbaniza, urbano, urbana, cidade, metropol, territori, agricultura, agropecuari, agronegocio, populac, migrac, migrante, demograf, globaliza, bacia, hidrograf, rio, rios, vegetac, bioma, cerrado, caatinga, amazonia, floresta, desmatamento, regiao, espaco geografic, industrializa, cartograf, mapa, escala, latitude, longitude, energia, hidreletric, petroleo, matriz energetica, ambiental, chuva, precipitac, temperatura, massas de ar, placas tectonic, vulcan, rochas, mineral, fronteira, transporte, logistica, rede urbana, fusos, geopolitic',
        'Filosofia': 'filosof*3, platao*3, aristoteles*3, socrates*3, kant*3, descartes*3, hobbes*3, locke*3, rousseau*3, nietzsche*3, maquiavel*3, hume*3, agostinho*3, tomas de aquino*3, sartre*3, foucault*3, arendt*3, espinosa*3, spinoza*3, hegel*3, heraclito*3, parmenides*3, epicur*3, estoic*3, etica, moral, razao, racional, virtude, metafisic*3, conhecimento, verdade, sofist*3, dialetic, contrato social*3, estado de natureza*3, alienacao, existencialis*3, empiris*3',
        'Sociologia': 'sociolog*3, durkheim*3, weber*3, marx*2, bauman*3, bourdieu*3, sociedade*0.6, social*0.6, sociais*0.6, desigualdade*0.6, movimentos sociais*2, cidadania*0.6, identidade*0.6, cultura*0.6, cultural*0.6, etnocentris*3, preconceito*0.6, racismo*0.6, genero*0.6, feminis*0.6, trabalho*0.6, trabalhador*0.6, classe social, capitalis*0.6, consumo*0.6, industria cultural*3, midia*0.6, redes sociais*0.6, democracia*0.6, participacao*0.6, politica*0.6, direitos humanos*0.6, violencia*0.6, indigena*0.6, quilombola*0.6',
    },
    'CN': {
        'Física': 'velocidade, aceleracao, forca, newton, energia cinetica, potencial, gravitacional, potencia, watt, joule, corrente eletric, resistor, resistencia, circuito, tensao, voltagem, volt, ampere, onda, ondas, frequencia, comprimento de onda, lente, espelho, optic, refracao, reflexao, calor, termic, dilatacao, pressao, massa, peso, gravidade, campo magnetic, ima, eletromagnet, induc, som, sonor, decibel, movimento, trajetoria, colisao, impulso, quantidade de movimento, torque, alavanca, hidrostatic, empuxo, densidade, lampada, motor, gerador, radiacao, fisic, resistencia interna*3, em serie*2, em paralelo*2, ligad*0.5, circuito*2',
        'Química': 'reacao, reacoes, quimic, molecula, molecul, atomo, atomic, ligacao, ligacoes, acido, acida, base, basic, ph, solucao, concentracao, mol, molar, substancia, composto, oxidacao, reducao, elemento, ion, ions, ionic, combustao, combustivel, polimero, organic, hidrocarboneto, eletrolise, pilha*0.5, bateria*0.5, equilibrio, catalisador, formula, isomer, sal, sais, soluvel, solubilidade, precipitado, titulacao, estequiometr, entalpia, funcao organica, alcool, ester, amina, hidrogenio, oxigenio, carbono, nitrogenio, metal, metais',
        'Biologia': 'celula, celular, gene, genetic, dna, rna, proteina, organismo, especie, especies, evoluc, ecossistema, ecolog, virus, bacteria, doenca, vacina, planta, plantas, animal, animais, fotossintese, enzima, imunolog, anticorpo, hormonio, cadeia alimentar, seletiva, selecao natural, mutac, tecido, orgao, sangue, biolog, nutriente, respiracao celular, mitocondria, cromossomo, hereditar, fenotipo, genotipo, parasita, infeccao, microrganismo, fungo, inseto, populacao, biodiversidade, bioma, vertebrado, reproducao, embrion',
    },
    'MT': {
        'Geometria': 'area, volume, angulo, triangulo, retangulo, quadrado, cilindro, cone, esfera, prisma, piramide, perimetro, circulo, circunferencia, raio, diametro, cubo, planificacao, vista superior, poligono, hexagono, trapezio, paralelepipedo, semelhanca, teorema de pitagoras, pitagoras, geometric, coordenadas, plano cartesiano, reta, simetria, rotacao, m2, m3, cm2, cm3',
        'Estatística e Probabilidade': 'media, mediana, moda, probabilidade, desvio padrao, variancia, chance, sorteio, sorteado, aleatori, estatistic, frequencia, grafico de barras, tabela, pesquisa, amostra, dados, combinacoes, permutac, arranjo, anagrama, possibilidades, maneiras diferentes',
        'Funções e Álgebra': 'funcao*2, funcoes*2, equacao, equacoes, inequacao, linear, quadratic, exponencial, logaritmo, polinomio, sistema, progressao, aritmetica, geometrica, termo geral, juros composto, juros simples, parabola, grafico da funcao, crescente, decrescente, variavel, incognita, expressao algebrica, matriz, taxa de variacao, f(x), grafico*0.5, reta*0.5, meses*0.3',
        'Números e Proporções': 'porcentagem, percentual, razao, proporcao, proporcional, regra de tres, fracao, fracoes, escala, unidade*0.5, conversao, litro, mililitro, quilometro, grandeza, divisor, multiplo, mmc, mdc, numero decimal, arredonda, desconto*0.5, aumento*0.5, preco*0.5, valor*0.5, custo*0.5, lucro*0.5, velocidade media*0.5, consumo*0.5',
    },
}
DEFAULT = {'LC': 'Língua Portuguesa', 'CH': 'História', 'CN': 'Biologia', 'MT': 'Números e Proporções'}

def compile_terms(v):
    for t in v.split(','):
        t = t.strip()
        if not t: continue
        term, _, w = t.partition('*')
        yield re.compile(r'(?<![a-z])' + re.escape(norm(term))), float(w or 1)

PATTERNS = {area: {d: list(compile_terms(v)) for d, v in ds.items()} for area, ds in KW.items()}
YEAR = re.compile(r'\b1[4-9]\d\d\b')
MIN_SCORE = {'LC': 2, 'CH': 0.5, 'CN': 0.5, 'MT': 1}

def area_of(n):
    return 'LC' if n <= 45 else 'CH' if n <= 90 else 'CN' if n <= 135 else 'MT'

result, dist = {}, Counter()
for year, days in textos.items():
    for day, qs in days.items():
        for qid, text in qs.items():
            n = int(re.match(r'\d+', qid).group())
            area = area_of(n)
            if area == 'LC' and n <= 5:
                disc = 'Inglês' if qid.endswith('en') else 'Espanhol'
            else:
                t = norm(text)
                scores = {d: sum(w * len(p.findall(t)) for p, w in pats) for d, pats in PATTERNS[area].items()}
                if area == 'CH': scores['História'] += 0.7 * len(YEAR.findall(t))
                best = max(scores, key=scores.get)
                disc = best if scores[best] >= MIN_SCORE[area] else DEFAULT[area]
            result.setdefault(year, {}).setdefault(day, {})[qid] = disc
            dist[(area, disc)] += 1
(app / 'data/disciplinas.json').write_text(json.dumps(result, ensure_ascii=False, indent=0))
for k, v in sorted(dist.items()): print(k, v)
