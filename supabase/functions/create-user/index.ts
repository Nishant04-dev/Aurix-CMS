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

    // Parse request body
    const { email, password, name, role, action = 'create', userId } = await req.json();

    // Validate action
    if (action === 'create') {
      // Permission check: only admin/manager can create users
      if (!isAdmin && !isManager) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Only admins and managers can create users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Manager cannot create admins
      if (role === 'admin' && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Only admins can create admin users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      if (!email || !password || !name || !role) {
        return new Response(JSON.stringify({ error: 'Missing required fields: email, password, name, role' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      });

      if (authError) throw authError;
      const newUserId = authData.user.id;

      // Create/Update the profile record
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: newUserId,
          email,
          name,
          role
        });

      if (profileError) throw profileError;

      // Map to internal user_roles if applicable
      const internalRole = (role === 'admin' || role === 'client') ? role : 'team';
      await supabaseClient.from('user_roles').upsert({
        user_id: newUserId,
        role: internalRole
      });

      return new Response(JSON.stringify({ success: true, userId: newUserId, message: 'User created successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'update') {
      console.log("UPDATE action - userId:", userId, "name:", name, "email:", email);
      
      // Update user profile
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required for update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Check if user is updating themselves or is admin/manager
      if (userId !== authUser.id && !isAdmin && !isManager) {
        return new Response(JSON.stringify({ error: 'Unauthorized to update this user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Build update data - ensure we have valid values
      const updateData: Record<string, string> = {};
      if (name && name.trim()) updateData.name = name.trim();
      if (email && email.trim()) updateData.email = email.trim();
      
      console.log("Update data:", updateData);

      // Only update if there's something to update
      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      console.log("Update error:", updateError);
      
      if (updateError) {
        console.error("Profile update failed:", updateError.message);
        throw new Error(updateError.message);
      }

      return new Response(JSON.stringify({ success: true, message: 'User updated successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'delete') {
      // Delete user
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required for delete' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Cannot delete yourself
      if (userId === authUser.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Only admin/manager can delete
      if (!isAdmin && !isManager) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Only admins and managers can delete users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Check if target user is admin - only admin can delete admin
      const { data: targetProfile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (targetProfile?.role === 'admin' && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Cannot delete admin users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Delete from auth (soft delete via disabling)
      await supabaseClient.auth.admin.updateUserById(userId, {
        email_confirm: false
      });

      // Update profile status
      await supabaseClient
        .from('profiles')
        .update({ role: 'inactive' })
        .eq('id', userId);

      return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'changeRole') {
      // Change user role
      if (!userId || !role) {
        return new Response(JSON.stringify({ error: 'userId and role are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Only admin can change roles
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Only admins can change roles' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Cannot change own role
      if (userId === authUser.id) {
        return new Response(JSON.stringify({ error: 'Cannot change your own role' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Update role
      const { error: roleError } = await supabaseClient
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (roleError) throw roleError;

      // Update user_roles table
      const internalRole = (role === 'admin' || role === 'client') ? role : 'team';
      await supabaseClient.from('user_roles').upsert({
        user_id: userId,
        role: internalRole
      });

      return new Response(JSON.stringify({ success: true, message: 'Role updated successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use: create, update, delete, changeRole' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

  } catch (error: any) {
    console.error("EDGE_FUNCTION_ERROR:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
