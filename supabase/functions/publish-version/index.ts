// Supabase Edge Function: publish-version
// Verifies the caller has engineer or admin role, then calls the SQL function publish_price_version()
// Deploy with: supabase functions deploy publish-version

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PublishRequest {
  source_version_id: string
  new_version_name: string
  notes?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create a Supabase client using the caller's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check the user's role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!['engineer', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only engineers and admins can publish price versions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse the request body
    const body: PublishRequest = await req.json()
    const { source_version_id, new_version_name, notes } = body

    if (!source_version_id || !new_version_name) {
      return new Response(JSON.stringify({ error: 'source_version_id and new_version_name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use service role for the actual publish (bypasses RLS for the copy operation)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the SQL function
    const { data: newVersionId, error: publishError } = await serviceClient.rpc('publish_price_version', {
      p_source_version_id: source_version_id,
      p_new_version_name: new_version_name,
      p_notes: notes ?? '',
      p_published_by: user.id,
    })

    if (publishError) {
      return new Response(JSON.stringify({ error: publishError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ new_version_id: newVersionId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
