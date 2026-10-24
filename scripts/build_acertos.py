"""Como os candidatos de verdade responderam cada questão do caderno Azul: quantos marcaram cada letra
(e quantos deixaram em branco), lido das respostas de todos os participantes nos microdados do INEP.
Lê o CSV de dentro do zip em streaming, como build_percentis.py.
Uso: python3 build_acertos.py <ano> <saida.json> [percentis.json]   (2025 precisa do pacote inflate64)
Com o terceiro argumento, aproveita a mesma leitura para gravar a distribuição das notas (como build_percentis.py).
Sem gabarito em PDF para o ano (2017), o caderno Azul da 1ª aplicação é o de mais participantes, e o gabarito
sai do próprio ITENS_PROVA."""
import csv, io, json, struct, sys, zlib
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from inep_zip import open_zip, curl

year, out = int(sys.argv[1]), sys.argv[2]
out_pct = sys.argv[3] if len(sys.argv) > 3 else None
URL = f'https://download.inep.gov.br/microdados/microdados_enem_{year}.zip'
CHUNK = 16 << 20
APP = Path(__file__).parent.parent
gab = json.loads((APP / 'data/gabaritos.json').read_text()).get(str(year))
START = {'LC': 1, 'CH': 46, 'CN': 91, 'MT': 136}
DAY = {'LC': 'd1', 'CH': 'd1', 'CN': 'd2', 'MT': 'd2'}

z = open_zip(year)
# códigos do caderno Azul da 1ª aplicação: o que tem o gabarito idêntico ao PDF (como em build_itens.py)
itens = list(csv.DictReader(io.StringIO(z.read(next(i.filename for i in z.infolist() if 'ITENS_PROVA' in i.filename and i.filename.endswith('.csv'))).decode('latin-1')), delimiter=';'))
provas = defaultdict(list)
for r in itens:
    if r['TX_COR'].upper() == 'AZUL': provas[(r['SG_AREA'], r['CO_PROVA'])].append(r)
azul = {}
for area, day in DAY.items():
    if gab is None: break
    def score(items):
        ok = 0
        for r in items:
            k = gab[day].get(r['CO_POSICAO'])
            if isinstance(k, list): k = k[0 if r['TP_LINGUA'] == '0' else 1]
            ok += k in (r['TX_GABARITO'], 'X')
        return ok / len(items)
    best, code = max((score(v), cp) for (a, cp), v in provas.items() if a == area)
    assert best == 1.0, (year, area)
    azul[area] = code
# sem gabarito: conta todos os cadernos Azuis e escolhe o mais feito no fim
candidatos = {area: {cp for (a, cp) in provas if a == area} for area in DAY} if gab is None else {a: {c} for a, c in azul.items()}
print(year, 'azul', azul or candidatos, flush=True)

info = next(i for i in z.infolist() if i.filename.endswith((f'MICRODADOS_ENEM_{year}.csv', f'RESULTADOS_{year}.csv')))
hdr = curl('-r', f'{info.header_offset}-{info.header_offset + 29}', URL)
n, m = struct.unpack('<HH', hdr[26:30])
start = info.header_offset + 30 + n + m
end = start + info.compress_size

def chunks():
    if info.compress_type == 9:  # Deflate64
        import inflate64
        feed = inflate64.Inflater().inflate
    else:
        feed = zlib.decompressobj(-15).decompress
    pos = start
    while pos < end:
        data = curl('-r', f'{pos}-{min(pos + CHUNK, end) - 1}', URL)
        pos += len(data)
        yield feed(data)

class Stream(io.RawIOBase):
    def __init__(self): self.it, self.buf = chunks(), b''
    def readable(self): return True
    def readinto(self, b):
        while not self.buf:
            try: self.buf = next(self.it)
            except StopIteration: return 0
        k = min(len(b), len(self.buf)); b[:k] = self.buf[:k]; self.buf = self.buf[k:]
        return k

reader = csv.reader(io.TextIOWrapper(io.BufferedReader(Stream(), 1 << 20), encoding='latin-1'), delimiter=';')
head = next(reader)
col = {k: head.index(k) for k in head}
LETRA = {c: i for i, c in enumerate('ABCDE')}
cont = defaultdict(lambda: [0] * 6)  # (código do caderno, questão) -> A B C D E branco
hist = {k: Counter() for k in ('LC', 'CH', 'CN', 'MT', 'd1', 'd2')}
rows = 0
for r in reader:
    rows += 1
    if out_pct:
        notas = {}
        for a in ('LC', 'CH', 'CN', 'MT'):
            if r[col[f'TP_PRESENCA_{a}']] == '1':
                v = r[col[f'NU_NOTA_{a}']]
                if v and float(v) > 0:
                    notas[a] = float(v)
                    hist[a][int(float(v))] += 1
        if 'LC' in notas and 'CH' in notas: hist['d1'][int((notas['LC'] + notas['CH']) / 2)] += 1
        if 'CN' in notas and 'MT' in notas: hist['d2'][int((notas['CN'] + notas['MT']) / 2)] += 1
    for area, codes in candidatos.items():
        code = r[col[f'CO_PROVA_{area}']]
        if code not in codes or r[col[f'TP_PRESENCA_{area}']] != '1':
            continue
        resp = r[col[f'TX_RESPOSTAS_{area}']]
        lang = 'en' if r[col['TP_LINGUA']] == '0' else 'es'
        if area == 'LC' and len(resp) == 50:  # 2021–2022: as 5 de inglês e as 5 de espanhol vêm juntas
            resp = (resp[:5] if lang == 'en' else resp[5:10]) + resp[10:]
        for i, ch in enumerate(resp):
            q = START[area] + i
            qid = f'{q}{lang}' if area == 'LC' and q <= 5 else str(q)
            cont[(code, qid)][LETRA.get(ch, 5)] += 1
    if rows % 500000 == 0: print(year, rows, flush=True)

if gab is None:
    # caderno Azul da 1ª aplicação = o Azul com mais participantes; gabarito do ITENS_PROVA
    feitos = defaultdict(int)
    for (code, qid), c in cont.items(): feitos[code] = max(feitos[code], sum(c))
    for area in DAY: azul[area] = max(candidatos[area], key=lambda c: feitos[c])
    gab_ano = {'d1': {}, 'd2': {}}
    for area, code in azul.items():
        for r in provas[(area, code)]:
            n = r['CO_POSICAO']
            k = r['TX_GABARITO'] if r['IN_ITEM_ABAN'] != '1' or r['TX_GABARITO'] in 'ABCDE' else 'X'
            d = gab_ano[DAY[area]]
            if area == 'LC' and int(n) <= 5:
                d.setdefault(n, [None, None])[0 if r['TP_LINGUA'] == '0' else 1] = k
            else:
                d[n] = k
    Path(out).with_suffix('.gab.json').write_text(json.dumps(gab_ano))
    print(year, 'azul escolhido', azul, {c: feitos[c] for c in azul.values()}, flush=True)
res = {}
for area, code in azul.items():
    for (c, qid), v in cont.items():
        if c == code: res.setdefault(DAY[area], {})[qid] = v
Path(out).write_text(json.dumps({'year': year, 'rows': rows, 'azul': azul, **res}, separators=(',', ':')))
if out_pct:
    pr = {k: {'n': sum(c.values()), 'min': min(c), 'h': [c.get(i, 0) for i in range(min(c), max(c) + 1)]} for k, c in hist.items()}
    Path(out_pct).write_text(json.dumps({'year': year, 'rows': rows, **pr}))
print(year, 'ok', rows, {d: len(v) for d, v in res.items()}, flush=True)
