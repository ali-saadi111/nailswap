#!/usr/bin/env python3
"""NailSwap dedicated Ubuntu/Debian server bootstrap. No embedded credentials."""
import base64
import fcntl
import getpass
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import yaml

ROOT = Path('/opt/nailswap')
BUNDLE = Path(__file__).resolve().parent
STACK = ROOT / 'supabase/docker'
TAG = 'self-hosted/v0.8.2'
COMMIT = '564eab8ad7840b13324f68b1bfac074ef8d51c21'
PROJECT = 'prj_Zyn6hSHLE2o422k7ZiosvU2tC0Bj'
TEAM = 'team_dhlQWc25H0HagWCnabvjAcFl'
SITE = 'https://nailswap.vercel.app'
NODE = 'node:24-bookworm-slim'


def run(args, *, cwd=None, data=None, private=False, env=None):
    result = subprocess.run(args, cwd=cwd, input=data, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    if result.returncode:
        if not private:
            print(result.stderr[-4000:], file=sys.stderr)
        elif ROOT.exists():
            diagnostic = result.stdout + '\n' + result.stderr
            hidden = [str(v) for k, v in (env or {}).items() if any(w in k for w in ('TOKEN', 'SECRET', 'PASSWORD', 'KEY'))]
            if (ROOT / 'setup-state.json').exists():
                hidden += [str(v) for v in json.loads((ROOT / 'setup-state.json').read_text()).values()]
            if (STACK / '.env').exists():
                hidden += list(load_env(STACK / '.env').values())
            for value in sorted(hidden, key=len, reverse=True):
                if len(value) >= 8:
                    diagnostic = diagnostic.replace(value, '[redacted]')
            write_private(ROOT / 'last-error.log', diagnostic[-30000:])
        raise RuntimeError(f'{args[0]} failed; exit {result.returncode}' +
                           (' (details: /opt/nailswap/last-error.log)' if private else ''))
    return result.stdout.strip()


def write_private(path, content):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(content, encoding='utf-8')
    temp.chmod(0o600)
    temp.replace(path)


def request(url, method='GET', body=None, headers=None):
    headers = dict(headers or {})
    if body is not None and not isinstance(body, bytes):
        body = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers,
                                                         method=method), timeout=60) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        # Never echo API response bodies: some include secrets or SQL input.
        raise RuntimeError(f'HTTP {error.code} from {urllib.parse.urlparse(url).hostname}') from None


def vercel(token, path, method='GET', body=None):
    separator = '&' if '?' in path else '?'
    return request('https://api.vercel.com' + path + separator + 'teamId=' + TEAM,
                   method, body, {'Authorization': 'Bearer ' + token})


def load_env(path):
    values = {}
    for line in path.read_text().splitlines():
        if re.match(r'^[A-Z][A-Z0-9_]*=', line):
            key, value = line.split('=', 1)
            values[key] = value
    return values


def update_env(path, updates):
    lines = path.read_text().splitlines()
    remaining = dict(updates)
    for n, line in enumerate(lines):
        key = line.split('=', 1)[0]
        if key in remaining:
            lines[n] = key + '=' + remaining.pop(key)
    lines.extend(k + '=' + v for k, v in remaining.items())
    write_private(path, '\n'.join(lines) + '\n')


def compose(*args, **kwargs):
    return run(['docker', 'compose', '--project-name', 'nailswap', '--env-file', '.env',
                '-f', 'nailswap-compose.yml', *args], cwd=STACK, **kwargs)


def sql(statement):
    return compose('exec', '-T', 'db', 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
                   '-v', 'ON_ERROR_STOP=1', '-qAt', data=statement, private=True)


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def wait_for(label, probe, seconds=240):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            value = probe()
            if value:
                print(label + ' ready.', flush=True)
                return value
        except (RuntimeError, OSError):
            pass
        time.sleep(5)
    raise RuntimeError(label + ' did not become ready. Check the troubleshooting guide.')


def make_compose(source):
    doc = yaml.safe_load(source)
    doc['name'] = 'nailswap'
    for name, service in doc['services'].items():
        service['container_name'] = ('realtime-dev.nailswap-realtime' if name == 'realtime'
                                     else 'nailswap-' + name)
        service.pop('ports', None)
    doc['services']['api-gw']['ports'] = ['127.0.0.1:18000:8000']
    doc['services']['caddy'] = {
        'image': 'caddy:2', 'restart': 'unless-stopped',
        'ports': ['80:80', '443:443', '443:443/udp'],
        'volumes': ['./Caddyfile:/etc/caddy/Caddyfile:ro',
                    'nailswap-caddy-data:/data', 'nailswap-caddy-config:/config'],
    }
    doc.setdefault('volumes', {}).update({'nailswap-caddy-data': {}, 'nailswap-caddy-config': {}})
    return doc


def prepare_stack(state, save):
    if not (ROOT / 'supabase').exists():
        print('Downloading pinned Supabase Docker stack...', flush=True)
        run(['git', 'clone', '--depth', '1', '--branch', TAG, '--filter=blob:none',
             '--sparse', 'https://github.com/supabase/supabase.git', str(ROOT / 'supabase')])
        run(['git', 'sparse-checkout', 'set', 'docker'], cwd=ROOT / 'supabase')
    if run(['git', 'rev-parse', 'HEAD'], cwd=ROOT / 'supabase') != COMMIT:
        raise RuntimeError('Supabase source revision differs from the tested pin.')
    envfile = STACK / '.env'
    if not state.get('keys_ready'):
        if (STACK / 'volumes/db/data/PG_VERSION').exists():
            raise RuntimeError('Database exists without recorded keys; refusing to regenerate secrets.')
        shutil.copyfile(STACK / '.env.example', envfile)
        run(['bash', 'utils/generate-keys.sh', '--update-env'], cwd=STACK, private=True)
        run(['bash', 'utils/add-new-auth-keys.sh', '--update-env'], cwd=STACK, private=True)
        state['keys_ready'] = True
        save()
    if not envfile.exists():
        raise RuntimeError('Saved database secrets are missing; restore .env from backup.')
    update_env(envfile, {
        'SUPABASE_PUBLIC_URL': state['backend'], 'API_EXTERNAL_URL': state['backend'] + '/auth/v1',
        'SITE_URL': SITE, 'ADDITIONAL_REDIRECT_URLS': SITE + '/**',
        'DASHBOARD_USERNAME': 'rico', 'ENABLE_SIGNUP': 'false', 'DISABLE_SIGNUP': 'true',
        'ENABLE_EMAIL_SIGNUP': 'false', 'ENABLE_PHONE_SIGNUP': 'false',
        'ENABLE_EMAIL_AUTOCONFIRM': 'false', 'ENABLE_PHONE_AUTOCONFIRM': 'false',
        'ENABLE_ANONYMOUS_USERS': 'false', 'FUNCTIONS_VERIFY_JWT': 'true',
        'OPENAI_API_KEY': '', 'COMPOSE_FILE': 'nailswap-compose.yml',
    })
    for file in STACK.glob('.env*'):
        file.chmod(0o600)
    doc = make_compose((STACK / 'docker-compose.yml').read_text())
    # Hook needs application schema, so it is enabled after migrations below.
    if state.get('schema_ready'):
        doc['services']['auth']['environment'].update({
            'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED': 'true',
            'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI': 'pg-functions://postgres/public/custom_access_token_hook',
        })
    write_private(STACK / 'nailswap-compose.yml', yaml.safe_dump(doc, sort_keys=False))
    write_private(STACK / 'Caddyfile', state['host'] + ' {\n'
                  '  @api path /auth/v1/* /rest/v1/* /storage/v1/* /realtime/v1/*\n'
                  '  handle @api {\n    reverse_proxy api-gw:8000\n  }\n'
                  '  handle {\n    respond "Not found" 404\n  }\n}\n')
    compose('config', '--quiet', private=True)
    print('Starting Supabase and HTTPS (first pull may take several minutes)...', flush=True)
    compose('up', '-d', '--wait', '--wait-timeout', '600', private=True)
    return load_env(envfile)


def migrate(app):
    sql('create schema if not exists nailswap_setup; revoke all on schema nailswap_setup from public;'
        'create table if not exists nailswap_setup.migrations(name text primary key, sha256 text not null);')
    for file in sorted((app / 'supabase/migrations').glob('*.sql')):
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        previous = sql('select sha256 from nailswap_setup.migrations where name=' + literal(file.name))
        if previous:
            if previous != digest:
                raise RuntimeError('Previously applied migration changed: ' + file.name)
            continue
        print('Applying ' + file.name, flush=True)
        sql('begin;\n' + file.read_text(encoding='utf-8') + '\ninsert into nailswap_setup.migrations values (' +
            literal(file.name) + ',' + literal(digest) + ');\ncommit;')
    # The app service role performs privileged RPCs, never anon/authenticated roles.
    sql('grant usage on schema public to service_role; '
        'grant all on all tables in schema public to service_role; '
        'grant all on all sequences in schema public to service_role; '
        'grant execute on all functions in schema public to service_role; '
        "notify pgrst, 'reload schema';")


def seed_catalog(app, state, save, keys):
    headers = {'apikey': keys['SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + keys['SERVICE_ROLE_KEY']}
    base = 'http://127.0.0.1:18000'
    wait_for('Storage', lambda: request(base + '/storage/v1/bucket', headers=headers) is not None)
    existing = request(base + '/storage/v1/bucket', headers=headers)
    for name, public in [('public-media', True), ('tryon', False), ('private-docs', False)]:
        if any(bucket['id'] == name for bucket in existing):
            if next(bucket['public'] for bucket in existing if bucket['id'] == name) != public:
                raise RuntimeError('Unexpected visibility for bucket ' + name)
        else:
            request(base + '/storage/v1/bucket', 'POST', {'id': name, 'name': name, 'public': public}, headers)
    if not state.get('owner_id'):
        email = 'catalog-owner@nailswap.invalid'
        # Recover an owner created immediately before an interrupted state save.
        owner = sql('select id from auth.users where email=' + literal(email))
        if not owner:
            user = request(base + '/auth/v1/admin/users', 'POST', {
                'email': email, 'password': secrets.token_urlsafe(48), 'email_confirm': True,
                'user_metadata': {'full_name': 'NailSwap test catalog'},
            }, headers)
            owner = user['id']
        state['owner_id'] = owner
        save()
    salon = sql("insert into public.salons(slug,name,owner_id,status,directory_approved,city) values "
                "('nailswap-test','NailSwap Test Studio'," + literal(state['owner_id']) +
                ",'active',true,'Beirut') on conflict(slug) do update set name=excluded.name returning id;").splitlines()[0]
    credits = json.loads((app / 'scripts/assets/designs/credits.json').read_text())
    for index, (slug, photos) in enumerate(credits.items()):
        photo = photos[0]
        image = app / 'scripts/assets/designs' / photo['file']
        storage_path = f'{salon}/designs/{slug}.webp'
        request(base + '/storage/v1/object/public-media/' + storage_path, 'POST', image.read_bytes(),
                {**headers, 'Content-Type': 'image/webp', 'x-upsert': 'true'})
        description = photo['attribution'] + ' Source: ' + photo['sourceUrl'] + ' (resized to WebP)'
        name = slug.replace('-', ' ').title()
        values = [salon, slug, name, description, storage_path,
                  'Precisely reproduce the nail color, pattern and finish shown in the reference photo.']
        design = sql('insert into public.designs(salon_id,slug,name,description,cover_path,prompt_text,is_featured,sort_order) values (' +
                     ','.join(literal(v) for v in values) + ',true,' + str(index) +
                     ') on conflict(salon_id,slug) do update set cover_path=excluded.cover_path returning id;').splitlines()[0]
        sql('insert into public.design_images(design_id,path,alt) select ' + literal(design) + ',' +
            literal(storage_path) + ',' + literal(description) + ' where not exists(select 1 from public.design_images where design_id=' +
            literal(design) + ' and path=' + literal(storage_path) + ');')
    print('Test catalog and private photo buckets ready.', flush=True)


def connect_vercel(token, state, keys, fal):
    values = {
        'NEXT_PUBLIC_APP_URL': SITE, 'NEXT_PUBLIC_ROOT_DOMAIN': 'nailswap.vercel.app',
        'NEXT_PUBLIC_SUPABASE_URL': state['backend'], 'NEXT_PUBLIC_SUPABASE_ANON_KEY': keys['ANON_KEY'],
        'SUPABASE_SERVICE_ROLE_KEY': keys['SERVICE_ROLE_KEY'],
        'INTERNAL_API_SECRET': state['internal_secret'], 'CRON_SECRET': state['cron_secret'],
        'TEST_ACCESS_PASSWORD': state['test_password'], 'NEXT_PUBLIC_DEFAULT_LOCALE': 'en',
        'FAL_EDIT_MODEL': 'fal-ai/nano-banana-2/edit', 'FAL_EDIT_FALLBACK_MODEL': '',
        'FAL_EDIT_RESOLUTION': '1K', 'AI_TRYON_PIPELINE': 'edit', 'AI_PROVIDER_RETRIES': '0',
        'AI_EDIT_TIMEOUT_MS': '120000', 'AI_COST_FAL_EDIT_USD': '0.08', 'PAYMENT_CARD_PROVIDER': 'none',
    }
    if fal:
        values['FAL_KEY'] = fal
    secret_names = {'SUPABASE_SERVICE_ROLE_KEY', 'INTERNAL_API_SECRET', 'CRON_SECRET', 'TEST_ACCESS_PASSWORD', 'FAL_KEY'}
    entries = [{'key': key, 'value': value, 'type': 'sensitive' if key in secret_names else 'encrypted',
                'target': ['production', 'preview']} for key, value in values.items()]
    result = vercel(token, f'/v10/projects/{PROJECT}/env?upsert=true', 'POST', entries)
    if result.get('failed'):
        raise RuntimeError('Vercel rejected environment entries. Check token permissions and rerun.')
    return values


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run sudo bash setup.sh')
    os.umask(0o077)
    if not (BUNDLE / 'app/package.json').exists():
        raise RuntimeError('Extract the complete package, including its app folder.')
    ROOT.mkdir(mode=0o700, exist_ok=True)
    ROOT.chmod(0o700)
    lock = (ROOT / 'setup.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError('Another NailSwap setup is running.') from None
    statefile = ROOT / 'setup-state.json'
    state = json.loads(statefile.read_text()) if statefile.exists() else {}
    save = lambda: write_private(statefile, json.dumps(state, indent=2) + '\n')
    if not state:
        if (ROOT / 'supabase').exists():
            raise RuntimeError('Unrecognized existing Supabase folder; refusing to adopt or overwrite it.')
        if shutil.disk_usage(ROOT).free < 25 * 1024**3:
            raise RuntimeError('At least 25 GiB free disk space is needed for initial setup.')
        for port in (80, 443, 18000):
            with socket.socket() as listener:
                try:
                    listener.bind(('0.0.0.0', port))
                except OSError:
                    raise RuntimeError(f'Port {port} is in use. Use a dedicated server or configure its existing proxy manually.') from None
    print('Target: Vercel khalid-services / nailswap (https://nailswap.vercel.app).')
    print('Create a Vercel token at https://vercel.com/account/tokens with access to that team.')
    token = getpass.getpass('Vercel token (hidden, not saved): ').strip()
    if not token:
        raise RuntimeError('A Vercel token is required.')
    project = vercel(token, '/v9/projects/' + PROJECT)
    if project.get('id') != PROJECT or project.get('name') != 'nailswap':
        raise RuntimeError('Vercel project verification failed.')
    fal = getpass.getpass('fal key (hidden; Enter preserves the key already on Vercel): ').strip()
    if not fal:
        existing = vercel(token, f'/v10/projects/{PROJECT}/env')
        if not any(e['key'] == 'FAL_KEY' and 'production' in e.get('target', []) for e in existing.get('envs', [])):
            raise RuntimeError('No production FAL_KEY exists; rerun and enter your fal key.')
    if not state:
        ip = input('Server PUBLIC IPv4 address: ').strip()
        if not ipaddress.IPv4Address(ip).is_global:
            raise RuntimeError('A public IPv4 address is required.')
        default_host = 'nailswap.' + ip + '.sslip.io'
        host = input(f'Backend hostname [{default_host}]: ').strip().lower() or default_host
        if not re.fullmatch(r'(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host):
            raise RuntimeError('Enter a hostname only, without https:// or a path.')
        if ip not in socket.gethostbyname_ex(host)[2]:
            raise RuntimeError('Hostname DNS does not resolve to the supplied public IP.')
        state.update(host=host, backend='https://' + host, internal_secret=secrets.token_hex(32),
                     cron_secret=secrets.token_hex(32), test_password=secrets.token_urlsafe(24))
        save()
    print('Ensure inbound TCP 80 and 443 are allowed by the server/cloud firewall.', flush=True)
    keys = prepare_stack(state, save)
    wait_for('Public HTTPS/auth', lambda: request(state['backend'] + '/auth/v1/health',
                                                headers={'apikey': keys['ANON_KEY']}))
    app = BUNDLE / 'app'
    migrate(app)
    state['schema_ready'] = True
    save()
    prepare_stack(state, save)
    seed_catalog(app, state, save, keys)
    sql("insert into public.app_config(key,value) values ('app_url'," + literal(SITE) +
        "),('internal_secret'," + literal(state['internal_secret']) +
        ') on conflict(key) do update set value=excluded.value;')
    connect_vercel(token, state, keys, fal)
    # Work from a fresh copy on every attempt; never embed secrets in the package.
    release = ROOT / 'releases' / (str(time.time_ns()))
    shutil.copytree(app, release)
    (release / '.vercel').mkdir()
    write_private(release / '.vercel/project.json', json.dumps({'projectId': PROJECT, 'orgId': TEAM, 'projectName': 'nailswap'}))
    print('Deploying to Vercel. This can take several minutes...', flush=True)
    env = {**os.environ, 'VERCEL_TOKEN': token, 'VERCEL_PROJECT_ID': PROJECT, 'VERCEL_ORG_ID': TEAM}
    output = run(['docker', 'run', '--rm', '-v', str(release) + ':/app', '-w', '/app',
                  '-e', 'VERCEL_TOKEN', '-e', 'VERCEL_PROJECT_ID', '-e', 'VERCEL_ORG_ID', NODE,
                  'sh', '-c', 'npx --yes vercel@58.0.0 deploy --prod --yes --token "$VERCEL_TOKEN"'],
                 env=env, private=True)
    urls = re.findall(r'https://[a-zA-Z0-9.-]+\.vercel\.app', output)
    if urls:
        state['last_deployment'] = urls[-1]
    credentials = 'Basic ' + base64.b64encode(('tester:' + state['test_password']).encode()).decode()
    health = wait_for('Vercel app', lambda: request(SITE + '/api/health', headers={'Authorization': credentials}))
    if health.get('database') != 'ok' or not health.get('integrations', {}).get('ai'):
        raise RuntimeError('Deployment completed, but database/AI configuration health check failed.')
    state['completed'] = True
    save()
    write_private(ROOT / 'ACCESS.txt', f'App: {SITE}/en/try\nUsername: tester\nPassword: {state["test_password"]}\n'
                  f'Backend: {state["backend"]}\nStudio SSH tunnel: ssh -L 18000:127.0.0.1:18000 USER@SERVER\n'
                  f'Studio URL: http://localhost:18000\nStudio user: rico\nStudio password: {keys["DASHBOARD_PASSWORD"]}\n')
    print('\nSetup complete: ' + SITE + '/en/try')
    print('Browser login username: tester')
    print('Read your generated password: sudo cat /opt/nailswap/ACCESS.txt')
    print('No paid image was generated by setup. Upload a hand photo to test Nano Banana 2 at 1K.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print('\nSetup stopped: ' + str(error), file=sys.stderr)
        print('Existing data was kept. Correct the issue and rerun sudo bash setup.sh.', file=sys.stderr)
        sys.exit(1)
