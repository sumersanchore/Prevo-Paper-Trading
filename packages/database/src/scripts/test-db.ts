import pg from 'pg';

const credentialsList = [
  { user: 'postgres', password: '', database: 'postgres' },
  { user: 'postgres', password: 'postgres', database: 'postgres' },
  { user: 'postgres', password: '@S@8949470181', database: 'postgres' },
  { user: 'trademitra', password: '@S@8949470181', database: 'postgres' },
  { user: 'trademitra', password: '@S@8949470181', database: 'trademitra' },
];

async function probe() {
  for (const cred of credentialsList) {
    console.log(`Probing: user="${cred.user}", database="${cred.database}", password="${cred.password}"`);
    const client = new pg.Client({
      host: 'localhost',
      port: 5432,
      user: cred.user,
      password: cred.password,
      database: cred.database,
    });
    try {
      await client.connect();
      console.log(`--> SUCCESS! Connected successfully!`);
      const res = await client.query('SELECT version();');
      console.log(`Version: ${res.rows[0].version}`);
      
      // Check if DB 'trademitra' exists
      const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname='trademitra';");
      console.log(`Does 'trademitra' database exist? ${dbCheck.rows.length > 0}`);
      
      await client.end();
      return;
    } catch (err: any) {
      console.log(`--> FAILED: ${err.message}`);
    }
  }
}

probe();
