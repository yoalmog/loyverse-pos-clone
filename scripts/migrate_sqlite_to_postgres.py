import sqlite3
import os
import sys
import argparse
import json
import datetime
import urllib.parse

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    psycopg2 = None

DEFAULT_BACKUP_PATH = os.path.abspath(r'C:\Users\Usuario\.gemini\antigravity-ide\brain\1fc8bd1e-2d63-4082-a9a1-89bd751986e0\backups\pos_backup_20261013_140257.sqlite')

TABLE_ORDER = [
    'stores',
    'users',
    'categories',
    'modifiers',
    'modifier_options',
    'dining_options',
    'discounts',
    'customers',
    'suppliers',
    'products',
    'product_variations',
    'product_modifiers',
    'shifts',
    'cash_movements',
    'orders',
    'order_items',
    'payments',
    'inventory_logs',
    'purchase_orders',
    'purchase_order_items',
    'audit_logs',
    'sync_queue',
    'auth_rate_limits',
    'user_sessions',
]

def run_migration(sqlite_path, database_url, dry_run=False):
    print("=" * 70)
    print("LOYVERSE POS CLONE — SQLITE TO POSTGRESQL DATA MIGRATION")
    print("=" * 70)
    print(f"SQLite Source: {sqlite_path}")
    print(f"PostgreSQL Target: {'DRY RUN (Simulated)' if dry_run else (database_url[:20] + '... [REDACTED]')}")
    print(f"Timestamp: {datetime.datetime.now().isoformat()}")
    print("-" * 70)

    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite source file not found: {sqlite_path}")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    # 1. Inspect source row counts and metrics
    source_stats = {}
    total_source_rows = 0
    for table in TABLE_ORDER:
        count = sqlite_conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
        source_stats[table] = count
        total_source_rows += count

    print(f"Total Source Records Across 24 Tables: {total_source_rows}")

    # Metrics
    stock_sum = sqlite_conn.execute("SELECT coalesce(sum(stock_quantity), 0) FROM products").fetchone()[0]
    orders_sum = sqlite_conn.execute("SELECT coalesce(sum(total), 0) FROM orders").fetchone()[0]
    payments_sum = sqlite_conn.execute("SELECT coalesce(sum(amount), 0) FROM payments").fetchone()[0]
    print(f"Key Totals in SQLite:")
    print(f"  - Total Product Stock Quantity: {stock_sum}")
    print(f"  - Total Order Sum (cents): S/ {orders_sum / 100:.2f} ({orders_sum} cents)")
    print(f"  - Total Payments Sum (cents): S/ {payments_sum / 100:.2f} ({payments_sum} cents)")
    print("-" * 70)

    if dry_run:
        print("[DRY-RUN] Validating SQLite records extraction and column mapping...")
        for table in TABLE_ORDER:
            rows = sqlite_conn.execute(f'SELECT * FROM "{table}"').fetchall()
            print(f"  Table '{table}': {len(rows)} records verified readable.")
        print("[DRY-RUN] Schema extraction completed successfully. Ready for PostgreSQL import.")
        sqlite_conn.close()
        return {
            'status': 'DRY_RUN_PASS',
            'source_rows': source_stats,
            'metrics': {'stock_sum': stock_sum, 'orders_sum': orders_sum, 'payments_sum': payments_sum}
        }

    if not psycopg2:
        raise ImportError("psycopg2 is required for PostgreSQL data migration. Please install psycopg2-binary.")

    if not database_url:
        raise ValueError("DATABASE_URL is required to perform PostgreSQL migration.")

    pg_conn = psycopg2.connect(database_url)
    pg_conn.autocommit = False

    try:
        pg_cursor = pg_conn.cursor()

        # Run schema migration 001 first if tables do not exist
        schema_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'migrations', '001_initial_schema.sql'))
        if os.path.exists(schema_file):
            with open(schema_file, 'r', encoding='utf-8') as sf:
                schema_sql = sf.read()
            pg_cursor.execute(schema_sql)
            print("Verified / applied 001_initial_schema.sql on PostgreSQL target.")

        target_stats = {}
        for table in TABLE_ORDER:
            # Check target row count before
            pg_cursor.execute(f'SELECT count(*) FROM "{table}"')
            before_count = pg_cursor.fetchone()[0]

            rows = sqlite_conn.execute(f'SELECT * FROM "{table}"').fetchall()
            if not rows:
                target_stats[table] = {'source': 0, 'inserted': 0, 'total': before_count}
                continue

            cols = rows[0].keys()
            col_names = ', '.join([f'"{c}"' for c in cols])
            placeholders = ', '.join(['%s' for _ in cols])

            insert_sql = f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            
            data_tuples = [tuple(r[c] for c in cols) for r in rows]
            execute_batch(pg_cursor, insert_sql, data_tuples, page_size=100)

            pg_cursor.execute(f'SELECT count(*) FROM "{table}"')
            after_count = pg_cursor.fetchone()[0]

            target_stats[table] = {
                'source': len(rows),
                'inserted': after_count - before_count,
                'total': after_count
            }
            print(f"Migrated '{table}': {len(rows)} source rows -> {after_count} target rows")

        # Consistency checks on target
        pg_cursor.execute("SELECT coalesce(sum(stock_quantity), 0) FROM products")
        pg_stock = float(pg_cursor.fetchone()[0])
        pg_cursor.execute("SELECT coalesce(sum(total), 0) FROM orders")
        pg_orders = int(pg_cursor.fetchone()[0])
        pg_cursor.execute("SELECT coalesce(sum(amount), 0) FROM payments")
        pg_payments = int(pg_cursor.fetchone()[0])

        print("-" * 70)
        print("Consistency Check:")
        print(f"  Stock Quantity: SQLite={stock_sum} | PG={pg_stock} | Match={stock_sum == pg_stock}")
        print(f"  Orders Total:   SQLite={orders_sum} | PG={pg_orders} | Match={orders_sum == pg_orders}")
        print(f"  Payments Total: SQLite={payments_sum} | PG={pg_payments} | Match={payments_sum == pg_payments}")

        if stock_sum != pg_stock or orders_sum != pg_orders or payments_sum != pg_payments:
            raise ValueError("Consistency check failed! Totals do not match.")

        pg_conn.commit()
        print("\nAll 24 tables migrated and verified successfully! Transaction committed.")
        return {
            'status': 'PASS',
            'target_stats': target_stats,
            'metrics_match': True
        }
    except Exception as e:
        pg_conn.rollback()
        print(f"\nMIGRATION FAILED: {e}")
        raise
    finally:
        pg_conn.close()
        sqlite_conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Migrate SQLite to Supabase PostgreSQL")
    parser.add_argument('--sqlite', default=DEFAULT_BACKUP_PATH, help="Path to SQLite backup file")
    parser.add_argument('--db-url', default=os.environ.get('DATABASE_URL', ''), help="PostgreSQL connection string")
    parser.add_argument('--dry-run', action='store_true', help="Perform dry-run verification without connecting to PG")
    args = parser.parse_args()

    run_migration(args.sqlite, args.db_url, dry_run=args.dry_run or not args.db_url)
