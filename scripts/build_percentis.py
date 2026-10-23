"""Distribuição das notas oficiais de TODOS os participantes de um ano (microdados do INEP),
para calcular o percentil: histograma por área (bins de 1 ponto) e da média do dia.
Lê o CSV de dentro do zip em streaming (sem salvar o arquivo de ~2 GB).
Uso: python3 build_percentis.py <ano> <saida.json>   (2025 precisa do pacote inflate64)"""
import csv, io, json, struct, sys, zlib
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from inep_zip import open_zip, curl

year, out = int(sys.argv[1]), sys.argv[2]
URL = f'https://download.inep.gov.br/microdados/microdados_enem_{year}.zip'
CHUNK = 16 << 20

z = open_zip(year)
info = next(i for i in z.infolist() if i.filename.endswith((f'MICRODADOS_ENEM_{year}.csv', f'RESULTADOS_{year}.csv')))
hdr = curl('-r', f'{info.header_offset}-{info.header_offset + 29}', URL)
n, m = struct.unpack('<HH', hdr[26:30])
start = info.header_offset + 30 + n + m
end = start + info.compress_size

def chunks():
    if info.compress_type == 9:  # Deflate64
        import inflate64
        dec = inflate64.Inflater()
        feed = dec.inflate
    else:
        dec = zlib.decompressobj(-15)
        feed = dec.decompress
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
hist = {k: Counter() for k in ('LC', 'CH', 'CN', 'MT', 'd1', 'd2')}
rows = 0
for r in reader:
    rows += 1
    notas = {}
    for a in ('LC', 'CH', 'CN', 'MT'):
        if r[col[f'TP_PRESENCA_{a}']] == '1':
            v = r[col[f'NU_NOTA_{a}']]
            if v and float(v) > 0:
                notas[a] = float(v)
                hist[a][int(float(v))] += 1
    if 'LC' in notas and 'CH' in notas: hist['d1'][int((notas['LC'] + notas['CH']) / 2)] += 1
    if 'CN' in notas and 'MT' in notas: hist['d2'][int((notas['CN'] + notas['MT']) / 2)] += 1
    if rows % 500000 == 0: print(year, rows, flush=True)
res = {k: {'n': sum(c.values()), 'min': min(c), 'h': [c.get(i, 0) for i in range(min(c), max(c) + 1)]} for k, c in hist.items()}
Path(out).write_text(json.dumps({'year': year, 'rows': rows, **res}))
print(year, 'ok', rows, {k: v['n'] for k, v in res.items()}, flush=True)
