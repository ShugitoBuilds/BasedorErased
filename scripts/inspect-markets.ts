import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function inspect() {
    const { data, error } = await supabase
        .from('market_index')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (data) {
        console.log('Recent Markets:');
        data.forEach(m => {
            console.log(`ID: ${m.market_id}`);
            console.log(`  Hash/URL: ${m.cast_hash}`);
            console.log(`  Likes (DB): ${m.likes_count}`);
            console.log(`  Status: ${m.status}`);
            console.log('-------------------');
        });
    } else {
        console.error(error);
    }
}

inspect();
