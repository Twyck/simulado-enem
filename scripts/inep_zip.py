"""Lê arquivos de dentro dos zips de microdados do INEP sem baixar o zip inteiro (HTTP Range)."""
import io, subprocess, zipfile

# usa curl (o Python do python.org não traz os certificados do sistema)
def curl(*args):
    return subprocess.run(['curl', '-sfL', *args], check=True, capture_output=True).stdout

class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        head = curl('-I', url).decode().lower()
        self.size = int([l for l in head.splitlines() if l.startswith('content-length')][-1].split(':')[1])
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def readinto(self, b):
        if self.pos >= self.size: return 0
        end = min(self.pos + len(b), self.size) - 1
        data = curl('-r', f'{self.pos}-{end}', self.url)
        b[:len(data)] = data
        self.pos += len(data)
        return len(data)

def open_zip(year):
    raw = RangeFile(f'https://download.inep.gov.br/microdados/microdados_enem_{year}.zip')
    return zipfile.ZipFile(io.BufferedReader(raw, buffer_size=4 << 20))
