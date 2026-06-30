Deno.serve(async (req) => {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const blob = await resp.blob()
    return new Response(blob, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') ?? 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      }
    })
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 })
  }
})
