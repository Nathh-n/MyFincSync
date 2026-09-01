// Supabase Edge Function: gemini-proxy
// Proxy untuk panggilan Google Gemini API agar API key TIDAK terekspos di client.
//
// Cara deploy:
//   supabase secrets set GEMINI_API_KEY=your_key
//   supabase functions deploy gemini-proxy
//
// Client memanggil: supabaseClient.functions.invoke('gemini-proxy', { body: { text, system } })

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text = body.text || '';
    const system = body.system || '';

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'Teks kosong' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY belum diset. Jalankan: supabase secrets set GEMINI_API_KEY=<key>' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const parts = [];
    if (system) parts.push({ text: system });
    parts.push({ text });

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });

    const geminiData = await geminiRes.json();

    return new Response(JSON.stringify(geminiData), {
      status: geminiRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
