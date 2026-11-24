import { handleMcp } from "@/lib/mcp/server";

export const runtime = "nodejs";

export const POST = (req: Request) => handleMcp(req);
export const GET = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });
export const DELETE = GET;
