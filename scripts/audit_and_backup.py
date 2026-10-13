import sqlite3
import os
import subprocess
import datetime
import json

repo_root = os.path.abspath('.')
repo_db = os.path.join(repo_root, 'data', 'pos.sqlite')
backup_dir = os.path.abspath(r'C:\Users\Usuario\.gemini\antigravity-ide\brain\1fc8bd1e-2d63-4082-a9a1-89bd751986e0\backups')
os.makedirs(backup_dir, exist_ok=True)

timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
backup_path = os.path.join(backup_dir, f'pos_backup_{timestamp}.sqlite')

# 1. Hot backup using SQLite backup API
src_conn = sqlite3.connect(repo_db)
dst_conn = sqlite3.connect(backup_path)
with dst_conn:
    src_conn.backup(dst_conn)
dst_conn.close()
src_conn.close()

print('BACKUP_CREATED:', backup_path)
print('BACKUP_SIZE:', os.path.getsize(backup_path))

# 2. PRAGMA integrity_check on backup
chk_conn = sqlite3.connect(backup_path)
res = chk_conn.execute('PRAGMA integrity_check').fetchall()
print('INTEGRITY_CHECK:', res)

# 3. Extract HEAD:data/pos.sqlite to compare
head_db_path = os.path.join(backup_dir, 'head_pos.sqlite')
head_bytes = subprocess.check_output(['git', 'show', 'HEAD:data/pos.sqlite'], cwd=repo_root)
with open(head_db_path, 'wb') as f:
    f.write(head_bytes)
print('HEAD_DB_SIZE:', len(head_bytes))

head_conn = sqlite3.connect(head_db_path)

# 4. Compare tables and row counts
tables = [r[0] for r in chk_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]

print('\n--- TABLE INVENTORY & COMPARISON ---')
print(f'{"Table":<30} | {"Local Rows":<12} | {"HEAD Rows":<12} | {"Diff":<8}')
print('-' * 70)

table_details = {}
for t in sorted(tables):
    local_count = chk_conn.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
    try:
        head_count = head_conn.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
    except Exception as e:
        head_count = 'N/A'
    diff = local_count - head_count if isinstance(head_count, int) else 'NEW'
    print(f'{t:<30} | {local_count:<12} | {head_count:<12} | {diff}')

    cols = chk_conn.execute(f'PRAGMA table_info("{t}")').fetchall()
    fks = chk_conn.execute(f'PRAGMA foreign_key_list("{t}")').fetchall()
    indices = chk_conn.execute(f'PRAGMA index_list("{t}")').fetchall()
    create_sql = chk_conn.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{t}'").fetchone()[0]
    table_details[t] = {
        'count': local_count,
        'head_count': head_count,
        'sql': create_sql,
        'cols': [{'cid': c[0], 'name': c[1], 'type': c[2], 'notnull': c[3], 'dflt': c[4], 'pk': c[5]} for c in cols],
        'fks': [{'id': f[0], 'seq': f[1], 'table': f[2], 'from': f[3], 'to': f[4]} for f in fks],
        'indices': [i[1] for i in indices]
    }

head_conn.close()
chk_conn.close()

# Save inventory JSON outside repo
inventory_path = os.path.join(backup_dir, f'inventory_{timestamp}.json')
with open(inventory_path, 'w', encoding='utf-8') as f:
    json.dump(table_details, f, indent=2)
print('\nINVENTORY_JSON_SAVED:', inventory_path)
