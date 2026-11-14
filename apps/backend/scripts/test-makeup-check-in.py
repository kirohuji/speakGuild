"""Run the real points service against an isolated PostgreSQL cluster; never uses DATABASE_URL from .env."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
from urllib.parse import quote
cluster = Path(tempfile.mkdtemp(prefix='speakguild-makeup-'))
data = cluster / 'data'
backend = Path(__file__).resolve().parents[1]
started = False

def run(*args, input=None, env=None, cwd=None):
    result = subprocess.run(args, input=input, text=True, capture_output=True, env=env, cwd=cwd)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout
try:
    run('initdb','-D',str(data),'-U','postgres','--auth=trust','--no-locale')
    run('pg_ctl','-D',str(data),'-l',str(cluster/'server.log'),'-o',f"-F -k {cluster} -p 55440 -h ''",'-w','start')
    started=True
    env=dict(os.environ, DATABASE_URL=f'postgresql://postgres@localhost:55440/postgres?host={quote(str(cluster),safe="")}')
    run('pnpm','exec','prisma','db','push','--skip-generate',env=env,cwd=backend)
    run('psql','-h',str(cluster),'-p','55440','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1',input='ALTER TABLE "user" ADD CONSTRAINT user_points_nonnegative CHECK(points>=0) NOT VALID;')
    migration=(backend/'prisma/migrations/20261114000200_makeup_check_in/migration.sql').read_text()
    run('psql','-h',str(cluster),'-p','55440','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1',
        input='CREATE SCHEMA migration_test; SET search_path TO migration_test; CREATE TABLE "user"(id TEXT PRIMARY KEY,points INTEGER NOT NULL DEFAULT 0); CREATE TABLE user_check_in(id TEXT PRIMARY KEY);'+migration+'DROP SCHEMA migration_test CASCADE;')
    print(run('pnpm','exec','ts-node','--transpile-only','scripts/test-makeup-check-in.ts',env=env,cwd=backend),end='')
finally:
    if started: run('pg_ctl','-D',str(data),'-m','immediate','-w','stop')
    shutil.rmtree(cluster)
