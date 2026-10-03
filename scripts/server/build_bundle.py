"""Build the portable server package from an explicit, credential-free allowlist."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import tarfile

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, default=repo.parent / 'NailSwap-Server-Setup')
args = parser.parse_args()
destination = args.output_dir.resolve()
destination.mkdir(parents=True, exist_ok=True)
if any(destination.iterdir()):
    raise SystemExit('Output folder already contains files. Choose a fresh output folder before rebuilding.')

for name in ('setup.sh', 'installer.py', 'README.txt'):
    shutil.copyfile(Path(__file__).parent / name, destination / name)

app = destination / 'app'
app.mkdir()
directories = ('src', 'messages', 'public', 'supabase/migrations', 'scripts/assets/designs')
excluded = {'node_modules', '.git', '.vercel', '.next', '__pycache__', 'models', 'server', 'backups', '.temp', '.branches'}
for directory in directories:
    for source in (repo / directory).rglob('*'):
        rel = source.relative_to(repo)
        if source.is_file() and not source.is_symlink() and not any(p in excluded or p.startswith('.env') for p in rel.parts):
            target = app / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)

for name in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'next.config.ts',
             'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs',
             'sentry.edge.config.ts', 'sentry.server.config.ts', 'vercel.json', '.vercelignore',
             '.gitignore'):
    if name == 'next-env.d.ts' and not (repo / name).exists():
        continue  # Next.js generates this ignored file on a fresh clone.
    shutil.copyfile(repo / name, app / name)
shutil.copyfile(repo / 'scripts/download-models.ts', app / 'scripts/download-models.ts')

# Reject accidental inclusion of actual local credentials, without printing values.
local_secrets = []
for source in (repo / '.env.local', repo / '.vercel/testing-env.json'):
    if source.exists():
        if source.suffix == '.json':
            values = json.loads(source.read_text()).values()
        else:
            values = [line.split('=', 1)[1].strip().strip('"\'') for line in source.read_text().splitlines()
                      if '=' in line and any(word in line.split('=', 1)[0] for word in ('SECRET', 'KEY', 'TOKEN', 'PASSWORD'))]
        local_secrets.extend(str(value).encode() for value in values if isinstance(value, str) and len(value) > 30)
for path in destination.rglob('*'):
    if path.is_file():
        data = path.read_bytes()
        if any(secret in data for secret in local_secrets) or b'fal_sk_' in data:
            raise SystemExit('Credential scan failed for ' + str(path.relative_to(destination)))

manifest = ''.join(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.relative_to(destination).as_posix() + '\n'
                   for path in sorted(destination.rglob('*')) if path.is_file())
(destination / 'SHA256SUMS').write_text(manifest)
archive = destination.with_suffix('.tar.gz')
with tarfile.open(archive, 'w:gz') as package:
    package.add(destination, arcname=destination.name)
print(f'Created {archive} ({archive.stat().st_size:,} bytes). Credential scan passed.')
