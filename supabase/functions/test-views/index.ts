import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabaseAdmin.from('products').select('id, views, title');
  return new Response(JSON.stringify({ data, error }), { headers: { "Content-Type": "application/json" } });
});
