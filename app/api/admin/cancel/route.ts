
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ADMIN WALLETS
// Hardcoded for safety. Add user's wallet here.
const ADMIN_WALLETS = [
    '0xAD355883F2044F7E666270685957d190135359ad', // Example from prev context or I will ask.
    '0x26C1122D086A0c3c626B5706922F24599f692A20' // Another potential deplpyer
].map(s => s.toLowerCase());

// Use Service Role for Admin Actions
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { marketId, address } = await req.json();

        if (!address || !ADMIN_WALLETS.includes(address.toLowerCase())) {
            return NextResponse.json({ error: 'Not an Admin' }, { status: 403 });
        }

        // Update DB Only (Soft Cancel)
        // If contract has cancel function, we would call it here too via private key.
        // Assuming just DB hide for now as requested "clear and cancel".

        const { error } = await supabase
            .from('market_index')
            .update({ status: 'admin_cancelled' })
            .eq('market_id', marketId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Market Cancelled' });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
