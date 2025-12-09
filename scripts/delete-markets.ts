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

async function deleteMarkets() {
    const idsToDelete = [8, 9];
    console.log(`Deleting markets: ${idsToDelete.join(', ')}...`);

    const { error } = await supabase
        .from('market_index')
        .delete()
        .in('market_id', idsToDelete);

    if (error) {
        console.error('Error deleting markets:', error);
        return;
    }

    console.log('Deletion successful.');
}

deleteMarkets();
