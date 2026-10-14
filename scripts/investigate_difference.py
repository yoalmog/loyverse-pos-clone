import sqlite3

conn = sqlite3.connect('data/pos.sqlite')
conn.row_factory = sqlite3.Row

# 1. Check orders where sum of payments != order total
diff_orders = conn.execute('''
    SELECT o.id, o.receipt_number, o.status, o.total, coalesce(p.pay_total, 0) as paid, (o.total - coalesce(p.pay_total, 0)) as diff, o.ticket_name, o.created_at
    FROM orders o
    LEFT JOIN (
        SELECT order_id, sum(amount) as pay_total
        FROM payments
        GROUP BY order_id
    ) p ON o.id = p.order_id
    WHERE o.total != coalesce(p.pay_total, 0)
''').fetchall()

print(f"=== Orders with Payment Differences: {len(diff_orders)} ===")
for r in diff_orders:
    print(dict(r))

# 2. Check total orders vs total payments
total_orders = conn.execute("SELECT count(*), sum(total) FROM orders").fetchone()
total_payments = conn.execute("SELECT count(*), sum(amount) FROM payments").fetchone()
print(f"\nOrders count: {total_orders[0]}, sum: {total_orders[1]} cents (S/ {total_orders[1]/100:.2f})")
print(f"Payments count: {total_payments[0]}, sum: {total_payments[1]} cents (S/ {total_payments[1]/100:.2f})")
print(f"Difference: {total_orders[1] - total_payments[1]} cents (S/ {(total_orders[1] - total_payments[1])/100:.2f})")

# 3. Check statuses of all orders
status_counts = conn.execute("SELECT status, count(*), sum(total) FROM orders GROUP BY status").fetchall()
print("\n=== Order Counts by Status ===")
for r in status_counts:
    print(f"Status: {r['status']}, Count: {r['count(*)']}, Total Cents: {r['sum(total)']}")

conn.close()
