import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function dump() {
    const { data: markets } = await supabase
        .from('market_index')
        .select('*')
        .eq('status', 'active');

    if (!markets) return console.log('No markets');

    console.log(`Found ${markets.length} active markets:`);
    markets.forEach(m => {
        console.log(`ID: ${m.market_id}`);
        console.log(`Hash: ${m.cast_hash}`);
        console.log(`User: ${m.author_username}`);
        console.log(`----------------`);
    });
}

dump();
