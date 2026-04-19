import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === "prnt.sc" ||
    h.endsWith(".prnt.sc") ||
    h === "prntscr.com" ||
    h.endsWith(".prntscr.com") ||
    h === "lightshot.com" ||
    h.endsWith(".lightshot.com")
  )
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Trích URL ảnh từ HTML (og:image — cách Zalo / messenger thường dùng).
 */
function extractImageFromHtml(html: string): string | null {
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i,
    /<img[^>]+id=["']screenshot-image["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+class=["'][^"']*screenshot[^"']*["'][^>]+src=["']([^"']+)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const raw = decodeHtmlEntities(m[1])
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
    }
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ imageUrl: null, error: "method" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as { url?: string }
    const rawUrl = typeof body.url === "string" ? body.url.trim() : ""
    if (!rawUrl) {
      return new Response(JSON.stringify({ imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let pageUrl: URL
    try {
      pageUrl = new URL(rawUrl)
    } catch {
      return new Response(JSON.stringify({ imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!isAllowedHost(pageUrl.hostname)) {
      return new Response(JSON.stringify({ imageUrl: null, error: "host_not_allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)

    const res = await fetch(pageUrl.toString(), {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
    clearTimeout(t)

    if (!res.ok) {
      return new Response(JSON.stringify({ imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const html = await res.text()
    if (html.length > 2_500_000) {
      return new Response(JSON.stringify({ imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const imageUrl = extractImageFromHtml(html)
    return new Response(JSON.stringify({ imageUrl: imageUrl ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ imageUrl: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
