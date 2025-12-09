import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectMarkets() {
    console.log('Fetching all markets...');

    const { data, error } = await supabase
        .from('market_index')
        .select('*');

    if (error) {
        console.error('Error fetching markets:', error);
        return;
    }

    console.log(`Found ${data.length} markets:`);
    data.forEach(market => {
        console.log(`[ID: ${market.market_id}] Status: ${market.status}, Author: ${market.author_username}, Cast: ${market.cast_text?.substring(0, 20)}...`);
    });
}

inspectMarkets();
