export async function GET() {
  return Response.json({ ok: true, service: 'DineUp', version: '0.2.0' })
}
