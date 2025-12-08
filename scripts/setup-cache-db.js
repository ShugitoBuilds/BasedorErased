const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- SUPABASE CACHE SETUP ---');
console.log('Run the following SQL in your Supabase SQL Editor:');
console.log('');
console.log(`
-- Table for caching user scores (Power User check)
CREATE TABLE IF NOT EXISTS user_scores (
    fid BIGINT PRIMARY KEY,
    score NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups (though PK deals with it)
CREATE INDEX IF NOT EXISTS idx_user_scores_last_updated ON user_scores(last_updated);
`);
console.log('');
console.log('----------------------------');
