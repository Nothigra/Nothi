// Retired: the one-off thumbnail backfill ran on 2026-09-30 (all products done).
// New uploads create their list thumbnail in the browser (MediaUploader).
Deno.serve(() => new Response(JSON.stringify({ done: true, retired: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
