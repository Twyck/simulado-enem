"""Gera data/sisu/<ano>.json: cursos do SISU com pesos, notas mínimas e nota de corte de cada modalidade.

Fonte: grades.csv de github.com/maiakanegae/sisu-data, coletado da API oficial do SISU
(sisu-api.sisu.mec.gov.br/api/v1/oferta/<código>/modalidades) depois do fim das inscrições.

    python3 scripts/build_sisu.py 2025 [caminho-ou-url-do-grades.csv]
"""
import csv, io, json, os, re, sys, urllib.request, subprocess

ano = sys.argv[1]
src = sys.argv[2] if len(sys.argv) > 2 else f'https://raw.githubusercontent.com/maiakanegae/sisu-data/main/data/{ano}/scraping/grades.csv'
if src.startswith('http'):
    text = subprocess.run(['curl', '-sL', src], capture_output=True, check=True).stdout.decode('utf-8')
else:
    text = open(src, encoding='utf-8').read()
rows = list(csv.reader(io.StringIO(text), delimiter=';'))

MIN = {'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'com', 'na', 'no', 'à', 'ao'}
KEEP = {'ABI', 'EAD', 'TI', 'II', 'III', 'IV'}
def titulo(s):
    s = re.sub(r'\s+', ' ', s.strip())
    out = []
    for i, w in enumerate(s.split(' ')):
        lw = w.lower()
        if w.upper() in KEEP or re.fullmatch(r'\(?[A-Z]+\)?', w) and w.strip('()') in KEEP:
            out.append(w.upper())
        elif i and lw in MIN:
            out.append(lw)
        else:
            out.append('-'.join(p[:1].upper() + p[1:] for p in lw.split('-')))
    return ' '.join(out)

def modalidade(texto):
    """Ampla concorrência ou uma das vagas da Lei de Cotas (Lei 12.711/2012).
    Códigos: A = ampla; E = escola pública; R = renda até 1 salário mínimo per capita;
    PPI / PP / I / Q = pretos, pardos e indígenas / pretos e pardos / indígenas / quilombolas; D = deficiência."""
    t = texto.strip()
    if t.lower() == 'ampla concorrência':
        return 'A'
    if '12.711' not in t:
        return None  # ações afirmativas próprias de cada instituição: regras variadas, ficam de fora
    c = 'E'
    if 'igual ou inferior a 1 salário' in t:
        c += 'R'
    if 'pretos, pardos ou indígenas' in t:
        c += 'PPI'
    elif 'pretos ou pardos' in t:
        c += 'PP'
    elif 'indígenas' in t:
        c += 'I'
    elif 'quilombolas' in t:
        c += 'Q'
    if 'deficiência' in t:
        c += 'D'
    return c

GRAU = ['Bacharelado', 'Licenciatura', 'Tecnológico', 'Área Básica de Ingresso (ABI)']
TURNO = ['Integral', 'Matutino', 'Vespertino', 'Noturno', 'EaD']
ies, campi, cursos = {}, {}, {}
idx = lambda d, k: d.setdefault(k, len(d))
num = lambda v: float(v) if v.strip() else 0.0
ofertas, outras, quando = [], 0, ''
for r in rows:
    cod, curso, grau, turno, vagas, campus, cidade, uf, ies_nome, ies_sg = r[:10]
    pcn, pch, plc, pmt, pred = map(num, r[10:15])
    mcn, mch, mlc, mmt, mred, mmed = map(num, r[15:21])
    cortes = []
    m = r[21:]
    for i in range(0, len(m), 5):
        nome, qt, corte, bonus, dt = m[i:i + 5]
        c = modalidade(nome)
        if c is None:
            outras += 1
            continue
        quando = max(quando, dt)
        # sem nota de corte = menos inscritos que vagas nessa modalidade
        cortes.append([c, round(num(corte), 2) or None, int(qt)])
    if not cortes:
        continue
    r2 = lambda v: round(v, 2)
    ofertas.append([
        int(cod), idx(cursos, titulo(curso)), GRAU.index(grau), TURNO.index(turno), int(vagas),
        idx(ies, (ies_sg.strip(), titulo(ies_nome))), idx(campi, (titulo(campus), cidade.strip(), uf.strip())),
        [r2(plc), r2(pch), r2(pcn), r2(pmt), r2(pred)],
        [r2(mlc), r2(mch), r2(mcn), r2(mmt), r2(mred), r2(mmed)],
        cortes,
    ])

inv = lambda d: [list(k) if isinstance(k, tuple) else k for k, _ in sorted(d.items(), key=lambda kv: kv[1])]
out = {
    'ano': int(ano),
    'atualizado': quando,
    'fonte': 'API oficial do SISU (sisu-api.sisu.mec.gov.br), via github.com/maiakanegae/sisu-data',
    'grau': GRAU, 'turno': TURNO,
    'cursos': inv(cursos), 'ies': inv(ies), 'campi': inv(campi),
    # oferta: [código, curso, grau, turno, vagas, ies, campus, pesos LC CH CN MT RED, mínimas LC CH CN MT RED média, cortes]
    'ofertas': ofertas,
}
os.makedirs('data/sisu', exist_ok=True)
with open(f'data/sisu/{ano}.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'{len(ofertas)} ofertas, {len(cursos)} cursos, {len(ies)} instituições; {outras} modalidades próprias ignoradas; corte de {quando}')
