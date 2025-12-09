import { Client } from 'pg';

const connectionString = 'postgres://postgres.umjxdkdbhkkcarpitkku:Deepblue%40567890%21%40%23@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString,
});

async function runMigration() {
    try {
        console.log('Connecting to database...');
        await client.connect();

        console.log('Adding columns...');
        await client.query(`
      ALTER TABLE market_index ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
      ALTER TABLE market_index ADD COLUMN IF NOT EXISTS threshold TEXT;
    `);

        console.log('Migration successful.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
