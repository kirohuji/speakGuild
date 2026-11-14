"""Isolated PostgreSQL projection test. Uses only a temporary cluster, never DATABASE_URL.
Run: python3 scripts/test-learning-statistics.py (requires initdb, pg_ctl and psql).
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import subprocess
import tempfile

cluster = Path(tempfile.mkdtemp(prefix='speakguild-statistics-'))
data = cluster / 'data'
started = False

def run(*args, input=None):
    return subprocess.run(args, input=input, text=True, check=True, capture_output=True).stdout

def sql(statement):
    return run('psql', '-h', str(cluster), '-p', '55439', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', input=statement)

try:
    run('initdb', '-D', str(data), '-U', 'postgres', '--auth=trust', '--no-locale')
    run('pg_ctl', '-D', str(data), '-l', str(cluster / 'server.log'), '-o', f"-F -k {cluster} -p 55439 -h ''", '-w', 'start')
    started = True
    sql('CREATE TABLE "user"(id TEXT PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'),(\'bob\'); CREATE TABLE user_daily_practice_run(id TEXT PRIMARY KEY,"userId" TEXT NOT NULL,date DATE NOT NULL,"attemptHistory" JSONB,stats JSONB,"attemptedItemIds" TEXT[] DEFAULT ARRAY[]::text[],"completedItemIds" TEXT[] DEFAULT ARRAY[]::text[]);')
    sql((Path(__file__).resolve().parents[1] / 'prisma/migrations/20261114000100_learning_statistics_projections/migration.sql').read_text())
    sql('''INSERT INTO "user" VALUES ('carol');
      INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('before-hourly','carol','2026-11-14','[{"date":"2026-11-14","stepId":"pre-q","hour":9,"createdAt":"2026-11-14T01:00:00Z"}]','{"activity":{"timer:pre:h09":{"activeSeconds":60}}}');''')
    sql((Path(__file__).resolve().parents[1] / 'prisma/migrations/20261114000300_hourly_learning_statistics/migration.sql').read_text())
    assert sql("SELECT question_count||','||active_seconds FROM learning_stat_hours WHERE user_id='carol' AND date='2026-11-14' AND hour=9;").strip() == '1,60'
    assert sql("SELECT active_days||','||unique_questions||','||question_days||','||active_seconds FROM learning_stat_totals WHERE user_id='carol';").strip() == '1,1,1,60'

    sql('''INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('one','alice','2026-11-13','[{"date":"2026-11-13","stepId":"a"},{"date":"2026-11-13","stepId":"a"}]','{"activity":{"source":{"activeSeconds":60}}}');
      UPDATE user_daily_practice_run SET "attemptHistory"="attemptHistory",stats='{"activity":{"source":{"activeSeconds":30}}}' WHERE id='one';
      INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('two','alice','2026-11-14','[{"date":"2026-11-14","stepId":"a"}]','{"activity":{"source":{"activeSeconds":20}}}');
      INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('other','bob','2026-11-14','[{"date":"2026-11-14","stepId":"b"}]','{}');''')
    assert sql("SELECT active_days||','||unique_questions||','||question_days||','||active_seconds FROM learning_stat_totals WHERE user_id='alice';").strip() == '2,1,2,80'
    assert sql("SELECT unique_questions FROM learning_stat_totals WHERE user_id='bob';").strip() == '1'
    sql('''BEGIN; INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('rolled-back','alice','2026-11-15','[{"date":"2026-11-15","stepId":"c"}]','{}'); ROLLBACK;''')
    assert sql("SELECT count(*) FROM learning_stat_day_questions WHERE question_id='c';").strip() == '0'
    def concurrent_source(i):
        sql(f'''INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('timer-{i}','alice','2026-11-14','[]','{{"activity":{{"timer-{i}":{{"activeSeconds":10}}}}}}');''')
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(concurrent_source, range(12)))
    assert sql("SELECT active_seconds FROM learning_stat_totals WHERE user_id='alice';").strip() == '200'
    plan = sql("SET enable_seqscan=off; EXPLAIN SELECT * FROM learning_stat_days WHERE user_id='alice' AND date>='2026-11-01' AND date<='2026-11-30';")
    assert 'Index' in plan
    sql('''INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('hour-one','bob','2026-11-14','[{"date":"2026-11-14","stepId":"hour-q","hour":14,"createdAt":"2026-11-14T06:00:00Z"}]','{"activity":{"timer:test:h14":{"activeSeconds":60}}}');
      INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('hour-two','bob','2026-11-14','[{"date":"2026-11-14","stepId":"hour-q","hour":13,"createdAt":"2026-11-14T05:00:00Z"}]','{"activity":{"timer:test:h14":{"activeSeconds":30}}}');''')
    assert sql("SELECT question_count||','||active_seconds FROM learning_stat_hours WHERE user_id='bob' AND date='2026-11-14' AND hour=14;").strip() == '0,60'
    assert sql("SELECT question_count FROM learning_stat_hours WHERE user_id='bob' AND date='2026-11-14' AND hour=13;").strip() == '1'
    sql('''INSERT INTO user_daily_practice_run(id,"userId",date,"attemptHistory",stats) VALUES ('hour-unknown','bob','2026-11-14','[{"date":"2026-11-14","stepId":"hour-q","createdAt":"2026-11-14T04:00:00Z"}]','{}');''')
    assert sql("SELECT question_count FROM learning_stat_hours WHERE user_id='bob' AND date='2026-11-14' AND hour=13;").strip() == '0'
    print('PostgreSQL statistics: migration, deduplication, date attribution, account isolation, rollback, concurrent timers and indexed range passed.')
finally:
    if started:
        run('pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')
    shutil.rmtree(cluster)
