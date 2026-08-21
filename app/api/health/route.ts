export async function GET() { return Response.json({ ok:true, service:"jale", timestamp:new Date().toISOString() }); }
