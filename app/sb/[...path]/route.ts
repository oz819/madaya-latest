import { NextRequest } from "next/server";

// Public demo backend (see lib/demo/engine.ts). Off unless the deployment sets NEXT_PUBLIC_DEMO=1,
// so on the real site this path is a plain 404 and never touches any data.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return new Response("Not found", { status: 404 });
  const { handleDemo } = await import("@/lib/demo/engine");
  return handleDemo(req, "/" + (await params).path.join("/"));
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE, handle as OPTIONS, handle as HEAD };
