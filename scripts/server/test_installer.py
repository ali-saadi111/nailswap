import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('installer.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def test_compose_has_no_public_database_or_studio(self):
        source = (Path('/research/docker-compose.yml')).read_text()
        doc = installer.make_compose(source)
        for name, service in doc['services'].items():
            if name not in ('caddy', 'api-gw'):
                self.assertNotIn('ports', service)
        self.assertEqual(doc['services']['api-gw']['ports'], ['127.0.0.1:18000:8000'])
        self.assertEqual(doc['services']['realtime']['container_name'], 'realtime-dev.nailswap-realtime')

    def test_env_update_preserves_generated_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('JWT_SECRET=keep-me\nSITE_URL=old\n')
            installer.update_env(path, {'SITE_URL': 'https://example.com', 'NEW': 'yes'})
            installer.update_env(path, {'SITE_URL': 'https://example.com'})
            self.assertEqual(installer.load_env(path), {'JWT_SECRET': 'keep-me', 'SITE_URL': 'https://example.com', 'NEW': 'yes'})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_migration_checksum_mismatch_stops(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory) / 'supabase/migrations'
            folder.mkdir(parents=True)
            (folder / '001.sql').write_text('select 1;')
            with patch.object(installer, 'sql', side_effect=['', 'old-checksum']) as sql:
                with self.assertRaisesRegex(RuntimeError, 'Previously applied migration changed'):
                    installer.migrate(Path(directory))
                self.assertEqual(sql.call_count, 2)

    def test_vercel_partial_failure_is_not_success(self):
        state = dict(backend='https://db.example.com', internal_secret='a', cron_secret='b', test_password='c')
        with patch.object(installer, 'vercel', return_value={'failed': [{'key': 'FAL_KEY'}]}) as api:
            with self.assertRaisesRegex(RuntimeError, 'Vercel rejected'):
                installer.connect_vercel('token', state, {'ANON_KEY': 'anon', 'SERVICE_ROLE_KEY': 'secret'}, '')
            entries = api.call_args.args[3]
            self.assertFalse(any(e['key'] == 'FAL_KEY' for e in entries))
            self.assertEqual(next(e['type'] for e in entries if e['key'] == 'SUPABASE_SERVICE_ROLE_KEY'), 'sensitive')


if __name__ == '__main__':
    unittest.main()
