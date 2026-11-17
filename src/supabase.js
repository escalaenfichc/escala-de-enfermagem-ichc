import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nxwmzicqnzzvrnnfjcmc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YEvecXErD5tSRat0Ecd_qg_galbQ1r0';

export const supabase = createClient(supabaseUrl, supabaseKey);
