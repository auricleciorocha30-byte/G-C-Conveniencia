
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfnmcuhxbrwgdrejmgmv.supabase.co';
const supabaseAnonKey = 'sb_publishable_EZjRt18Ldabla7G6bYqAWQ_QUFLo4fO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
