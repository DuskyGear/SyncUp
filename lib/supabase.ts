
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://torlpxqwzxckutcrynxr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qeTgGIjn0z4uKaF4n4vJVg_7cE6p5qR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
