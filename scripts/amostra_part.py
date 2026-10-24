"""Amostra de participantes (primeiras N linhas) e o ITENS_PROVA de um ano, para conferir a nota TRI
com scripts/check_tri.mjs. Uso: python3 amostra_part.py <ano> <dir> [N]"""
import csv, io, struct, sys, zlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from inep_zip import open_zip, curl

year, out, N = int(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 150000
URL = f'https://download.inep.gov.br/microdados/microdados_enem_{year}.zip'
z = open_zip(year)
it = next(i.filename for i in z.infolist() if 'ITENS_PROVA' in i.filename and i.filename.endswith('.csv'))
(out / f'ITENS_{year}.csv').write_bytes(z.read(it))
info = next(i for i in z.infolist() if i.filename.endswith((f'MICRODADOS_ENEM_{year}.csv', f'RESULTADOS_{year}.csv')))
hdr = curl('-r', f'{info.header_offset}-{info.header_offset + 29}', URL)
n, m = struct.unpack('<HH', hdr[26:30])
start = info.header_offset + 30 + n + m
end = start + info.compress_size

def chunks():
    if info.compress_type == 9:
        import inflate64
        feed = inflate64.Inflater().inflate
    else:
        feed = zlib.decompressobj(-15).decompress
    pos = start
    while pos < end:
        data = curl('-r', f'{pos}-{min(pos + (8 << 20), end) - 1}', URL)
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
cols = ['TP_LINGUA'] + [f'{p}_{a}' for a in ('LC', 'CH', 'CN', 'MT') for p in ('CO_PROVA', 'NU_NOTA', 'TX_RESPOSTAS', 'TX_GABARITO', 'TP_PRESENCA')]
idx = [head.index(c) for c in cols]
with open(out / f'PART_{year}.csv', 'w', encoding='latin-1') as f:
    f.write(';'.join(cols) + '\n')
    for i, r in enumerate(reader):
        if i >= N: break
        f.write(';'.join(r[j] for j in idx) + '\n')
print(year, 'ok')
