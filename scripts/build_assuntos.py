"""Matéria e assunto de cada questão → data/assuntos.json.
A classificação (scripts/assuntos/*.out, "ano-questão CÓDIGO") foi feita lendo o enunciado de cada questão."""
import json, re, sys
from pathlib import Path

app = Path(sys.argv[1])
TAX = {
    'Matemática': {'PJ': 'Porcentagem e juros', 'RP': 'Razão, proporção e escala', 'AR': 'Aritmética e números',
                   'GM': 'Grandezas e unidades de medida', 'FN': 'Funções', 'EL': 'Exponencial e logaritmo',
                   'SQ': 'Sequências e padrões', 'EQ': 'Equações, sistemas e matrizes', 'GP': 'Geometria plana',
                   'GE': 'Geometria espacial', 'TR': 'Trigonometria', 'GA': 'Geometria analítica',
                   'ES': 'Estatística', 'PB': 'Probabilidade', 'CO': 'Análise combinatória',
                   'GT': 'Leitura de gráficos e tabelas', 'LO': 'Raciocínio lógico'},
    'Física': {'F1': 'Mecânica', 'F2': 'Energia, trabalho e potência', 'F3': 'Hidrostática', 'F4': 'Termologia e calor',
               'F5': 'Ondas e acústica', 'F6': 'Óptica e radiação', 'F7': 'Eletricidade', 'F8': 'Eletromagnetismo'},
    'Química': {'Q1': 'Atomística e radioatividade', 'Q2': 'Ligações e propriedades das substâncias', 'Q3': 'Soluções e concentração',
                'Q4': 'Estequiometria e gases', 'Q6': 'Cinética e equilíbrio químico', 'Q7': 'Ácidos, bases e pH',
                'Q8': 'Eletroquímica e oxirredução', 'Q9': 'Química orgânica', 'Q10': 'Química ambiental', 'Q11': 'Separação de misturas'},
    'Biologia': {'B1': 'Ecologia e meio ambiente', 'B2': 'Genética e biotecnologia', 'B3': 'Evolução', 'B4': 'Citologia e bioquímica',
                 'B5': 'Fisiologia humana', 'B6': 'Saúde, doenças e imunologia', 'B7': 'Botânica', 'B8': 'Zoologia'},
    'História': {'H1': 'Brasil Colônia', 'H2': 'Brasil Império', 'H3': 'Brasil República', 'H4': 'Antiguidade e Idade Média',
                 'H5': 'Idade Moderna', 'H6': 'Idade Contemporânea', 'H7': 'Cultura, patrimônio, africanos e indígenas'},
    'Geografia': {'G1': 'Cartografia e geotecnologias', 'G2': 'Natureza: clima, relevo, solos e água', 'G3': 'Meio ambiente e recursos naturais',
                  'G4': 'Urbanização e cidades', 'G5': 'Espaço agrário', 'G6': 'Indústria, economia e globalização',
                  'G7': 'População e migrações', 'G8': 'Geopolítica'},
    'Filosofia': {'P1': 'Filosofia antiga', 'P2': 'Filosofia moderna', 'P3': 'Ética e política', 'P4': 'Filosofia contemporânea'},
    'Sociologia': {'S1': 'Trabalho e sociedade', 'S2': 'Cultura e identidade', 'S3': 'Cidadania, direitos e movimentos sociais',
                   'S4': 'Desigualdade, gênero, raça e violência', 'S5': 'Mídia e tecnologia'},
    'Língua Portuguesa': {'L1': 'Interpretação e gêneros textuais', 'L2': 'Variação linguística', 'L3': 'Funções da linguagem e recursos expressivos',
                          'L4': 'Coesão e gramática', 'L5': 'Argumentação e publicidade', 'L6': 'Tecnologias da comunicação'},
    'Literatura': {'T1': 'Poesia', 'T2': 'Prosa: romance, conto e crônica'},
    'Artes': {'A1': 'Artes visuais', 'A2': 'Música', 'A3': 'Dança, teatro e cinema'},
    'Educação Física': {'E1': 'Esporte e práticas corporais', 'E2': 'Corpo, saúde e sociedade'},
}
code = {c: (m, a) for m, d in TAX.items() for c, a in d.items()}
out = {}
for f in sorted((app / 'scripts/assuntos').glob('*.out')):
    for line in f.read_text().split('\n'):
        if not line.strip(): continue
        key, c = line.split()
        year, q = key.split('-')
        n = int(re.match(r'\d+', q).group())
        m, a = code[c]
        out.setdefault(year, {}).setdefault('d1' if n <= 90 else 'd2', {})[q] = [m, a]
for year in out:  # língua estrangeira: questões 1 a 5 de cada língua
    for n in range(1, 6):
        out[year]['d1'][f'{n}en'] = ['Inglês', 'Interpretação de texto em inglês']
        out[year]['d1'][f'{n}es'] = ['Espanhol', 'Interpretação de texto em espanhol']
total = sum(len(d) for y in out.values() for d in y.values())
assert total == 925 + 4 * 185, total
(app / 'data/assuntos.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
from collections import Counter
print(total, 'questões'); print(Counter(v[0] for y in out.values() for d in y.values() for v in d.values()))
