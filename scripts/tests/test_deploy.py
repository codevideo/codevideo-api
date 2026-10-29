"""Exercise deployment ordering and failure gates without Docker or production access."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy.sh'
MOCK = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
a = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as f:
    f.write(json.dumps([name] + a) + '\\n')
if name == 'pgrep':
    if os.environ.get('FAIL_STAGE') == 'legacy':
        print('123 /root/codevideo-api/worker/codevideo -m serve')
    else: sys.exit(1)
elif name == 'git':
    if a[0] == 'rev-parse': print('abc123')
    elif os.environ.get('FAIL_STAGE') == 'dirty': print(' M config')
elif name == 'docker':
    if a[0] == 'inspect':
        fmt = a[2]
        if '.Name' in fmt: print('/service local-image sha256:old')
        elif '.State.Running' in fmt:
            print('false 1' if os.environ.get('FAIL_STAGE') == 'restart' else 'true 0')
        else: print('container-id 0')
    elif a[0] == 'compose':
        if a[1] == 'version': sys.exit(0)
        a = a[3:]
        stage = a[0]
        if stage == os.environ.get('FAIL_STAGE'): sys.exit(17)
        if stage == 'ps' and '-q' in a: print('container-id')
        if stage == 'logs': print('Watching for new manifest files')
'''


class DeployTests(unittest.TestCase):
    def run_deploy(self, failure=''):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bindir = root / 'bin'
            bindir.mkdir()
            for name in ('docker', 'git', 'curl', 'sleep', 'pgrep'):
                executable = bindir / name
                executable.write_text(MOCK)
                executable.chmod(0o755)
            for name in ('.env', '.env.staging'):
                (root / name).write_text('SECRET=never-print-this\n')
            conf = root / 'nginx/conf'
            conf.mkdir(parents=True)
            (conf / 'test.conf').write_text(
                'ssl_certificate /etc/nginx/ssl/live/missing/fullchain.pem;\n'
                if failure == 'certificate' else '# no TLS paths in this fixture\n')
            if failure == 'environment':
                (root / '.env.staging').unlink()
            env = dict(os.environ, PATH=str(bindir) + os.pathsep + os.environ['PATH'],
                       CALL_LOG=str(root / 'calls'), FAIL_STAGE=failure)
            env.pop('DOCKERHUB_USERNAME', None)
            env.pop('DOCKERHUB_TOKEN', None)
            result = subprocess.run(['bash', str(SCRIPT)], cwd=root, env=env,
                                    capture_output=True, text=True)
            import json
            calls = [json.loads(line) for line in (root / 'calls').read_text().splitlines()]
            self.assertNotIn('never-print-this', result.stdout + result.stderr)
            return result, calls

    def test_success_orders_pull_build_start_and_excludes_certbot(self):
        result, calls = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        operations = [c[4:] for c in calls if c[:2] == ['docker', 'compose'] and len(c) > 4]
        pull = next(i for i, c in enumerate(operations) if c[0] == 'pull')
        build = next(i for i, c in enumerate(operations) if c[0] == 'build')
        up = next(i for i, c in enumerate(operations) if c[0] == 'up')
        self.assertLess(pull, build)
        self.assertLess(build, up)
        self.assertIn('--ignore-buildable', operations[pull])
        self.assertIn('--no-build', operations[up])
        self.assertIn('never', operations[up])
        self.assertNotIn('certbot', operations[up])

    def test_success_prunes_only_week_old_dangling_images_after_verification(self):
        result, calls = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        prunes = [c for c in calls if 'prune' in c]
        self.assertEqual(prunes, [
            ['docker', 'image', 'prune', '-f', '--filter', 'until=168h'],
            ['docker', 'builder', 'prune', '-f', '--filter', 'until=168h'],
        ])
        # Rollback images and volumes must survive: never --all, system or volume prunes.
        self.assertFalse(any(flag in c for c in prunes for flag in ('-a', '--all', 'system', 'volume')))
        soak_checks = [i for i, c in enumerate(calls)
                       if c[:2] == ['docker', 'inspect'] and '.State.Running' in c[3]]
        self.assertLess(soak_checks[-1], calls.index(prunes[0]))

    def test_failed_pull_or_build_never_recreates_containers(self):
        for failure in ('pull', 'build', 'dirty', 'certificate', 'environment', 'legacy'):
            with self.subTest(failure=failure):
                result, calls = self.run_deploy(failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(c[:2] == ['docker', 'compose'] and 'up' in c for c in calls))
                self.assertFalse(any('prune' in c for c in calls))

    def test_restart_fails_verification(self):
        result, calls = self.run_deploy('restart')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('stopped or restarted', result.stderr)
        self.assertFalse(any('prune' in c for c in calls))


if __name__ == '__main__':
    unittest.main()
