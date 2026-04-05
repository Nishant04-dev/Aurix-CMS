import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header to check user role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Get the requester's role from profiles
    const { data: requesterProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    const requesterRole = requesterProfile?.role || 'client';
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const isManager = requesterRole === 'manager';

    // Only admin/manager can create clients
    if (!isAdmin && !isManager) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Only admins and managers can create clients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { name, company, email, phone, password } = await req.json();

    // Validate required fields
    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields: name, email, password' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log("Creating client:", { name, company, email });

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, company }
    });

    if (authError) throw authError;
    const userId = authData.user.id;
    console.log("Auth user created:", userId);

    // 2. Assign the 'client' role
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .upsert({ user_id: userId, role: 'client' });

    if (roleError) console.warn("Role error (non-fatal):", roleError.message);

    // 3. Create the client profile record
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .insert({
        user_id: userId,
        name,
        company,
        email,
        phone
      })
      .select()
      .single();

    if (clientError) throw clientError;
    console.log("Client record created:", client.id);

    // 4. Update the public profile
    await supabaseClient.from('profiles').upsert({
       id: userId,
       name: name,
       email: email,
       role: 'client'
    }).catch(e => console.warn("Profile update warn:", e.message));

    return new Response(JSON.stringify({ success: true, clientId: client.id, message: 'Client created successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("EDGE_FUNCTION_ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
