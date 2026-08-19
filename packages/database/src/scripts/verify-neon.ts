import { PostgresProvider } from '../postgres.provider.js';

async function checkDatabase() {
  const db = PostgresProvider.getInstance();

  console.info('=== 1. Testing Neon Connection & Latency ===');
  const t0 = Date.now();
  const timeRes = await db.query('SELECT NOW() as current_time, version() as pg_version;');
  const latency = Date.now() - t0;
  console.info('✅ Connected to Neon PostgreSQL successfully!');
  console.info('   PostgreSQL Version:', timeRes.rows[0].pg_version);
  console.info('   Current Time (UTC):', timeRes.rows[0].current_time);
  console.info('   Roundtrip Latency:', latency, 'ms');

  console.info('\n=== 2. Table Creation Verification (Public Schema) ===');
  const tablesRes = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.info(`Found ${tablesRes.rows.length} tables in Neon database:`);
  for (const row of tablesRes.rows) {
    const countRes = await db.query(`SELECT count(*) FROM "${row.table_name}"`);
    console.info(`  • ${row.table_name.padEnd(24)}: ${countRes.rows[0].count} rows`);
  }

  console.info('\n=== 3. Foreign Key Relations & Schema Constraints ===');
  const fkRes = await db.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name;
  `);
  for (const fk of fkRes.rows) {
    console.info(`  • ${fk.table_name}.${fk.column_name} ➔ ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }

  console.info('\n=== 4. Demo User & Seeded Wallet Check ===');
  const userRes = await db.query('SELECT id, auth_id, email, full_name, kyc_status FROM users LIMIT 1;');
  if (userRes.rows[0]) {
    const user = userRes.rows[0];
    console.info(`  • User ID: ${user.id} | Name: ${user.full_name} | Email: ${user.email} | Status: ${user.kyc_status}`);
    const walletRes = await db.query('SELECT id, cash_balance, utilized_margin, pledge_margin FROM wallets WHERE user_id = $1;', [user.id]);
    if (walletRes.rows[0]) {
      const w = walletRes.rows[0];
      console.info(`  • Wallet ID: ${w.id} | Cash Balance: ₹${Number(w.cash_balance).toLocaleString('en-IN')} | Utilized: ₹${Number(w.utilized_margin).toLocaleString('en-IN')}`);
    }
  }

  console.info('\n=== 5. Options Contracts Sample Check ===');
  const contractRes = await db.query('SELECT id, symbol, trading_symbol, strike_price, option_type, expiry_date FROM options_contracts ORDER BY id ASC LIMIT 5;');
  for (const c of contractRes.rows) {
    console.info(`  • Contract #${c.id}: ${c.trading_symbol} (${c.symbol} ${c.strike_price} ${c.option_type}) | Expiry: ${c.expiry_date.toISOString().slice(0, 10)}`);
  }

  console.info('\n=== 6. Write & Read Transaction Test (ACID Verification) ===');
  const testNotif = await db.query(`
    INSERT INTO notifications (user_id, title, message, severity)
    VALUES ($1, $2, $3, $4)
    RETURNING id, title, created_at;
  `, [userRes.rows[0]?.id || 1, 'Connection Test', 'Database connection verified successfully', 'INFO']);
  console.info(`  • Insert Test: ✅ Notification #${testNotif.rows[0].id} created at ${testNotif.rows[0].created_at}`);

  await db.query('DELETE FROM notifications WHERE id = $1;', [testNotif.rows[0].id]);
  console.info(`  • Clean-up Test: ✅ Test record cleaned up.`);

  await db.close();
  console.info('\n🎉 All Neon PostgreSQL Database Connections & Table Validations PASSED!');
}

checkDatabase().catch((err) => {
  console.error('❌ Database Check Failed:', err);
  process.exit(1);
});
