import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Missing Supabase Environment Variables - Supabase client will not work');
}

// Create a single supabase client for interacting with your database
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
    SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || ''
);
