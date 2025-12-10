import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function verify() {
    const { data: markets, error } = await supabase
        .from('market_index')
        .select('market_id, status, likes_count, cast_hash')
        .eq('status', 'active');

    if (error) {
        console.error('Error fetching markets:', error);
        return;
    }

    console.log(`Active Markets (${markets?.length || 0}):`);
    if (markets?.length) {
        // Log as JSON for clear readability in terminal output
        console.log(JSON.stringify(markets, null, 2));
    } else {
        console.log('No active markets found.');
    }
}
verify();
