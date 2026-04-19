import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_config" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const jwt = authHeader.slice(7)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authErr } = await admin.auth.getUser(jwt)
  if (authErr || !authData.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("user_id", authData.user.id)
    .single()

  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  let body: {
    action?: string
    email?: string
    password?: string
    full_name?: string
    role?: string
    user_id?: string
    department?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const action = body.action

  if (action === "create") {
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : ""
    const role = typeof body.role === "string" ? body.role : ""
    const departmentRaw = body.department
    const department =
      typeof departmentRaw === "string" && departmentRaw.trim() !== ""
        ? departmentRaw.trim()
        : null
    if (!email || !password || !full_name || !["admin", "manager", "employee"].includes(role)) {
      return new Response(JSON.stringify({ error: "invalid_fields" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "create_failed" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    const now = new Date().toISOString()
    const { error: upErr } = await admin
      .from("users")
      .update({
        role,
        full_name,
        department,
        password_updated_at: now,
      })
      .eq("user_id", created.user.id)

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  if (action === "update_password") {
    const user_id = typeof body.user_id === "string" ? body.user_id : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!user_id || password.length < 6) {
      return new Response(JSON.stringify({ error: "invalid_password" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { error: upAuthErr } = await admin.auth.admin.updateUserById(user_id, { password })
    if (upAuthErr) {
      return new Response(JSON.stringify({ error: upAuthErr.message }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { error: upRowErr } = await admin
      .from("users")
      .update({ password_updated_at: new Date().toISOString() })
      .eq("user_id", user_id)

    if (upRowErr) {
      return new Response(JSON.stringify({ error: upRowErr.message }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), {
    status: 400,
    headers: { ...cors, "Content-Type": "application/json" },
  })
})
