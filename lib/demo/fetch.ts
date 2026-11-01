import "server-only";

// In the public demo, server code talks to the in-process demo database directly (no HTTP round
// trip, and no need to know the site's own address — any Netlify deploy URL works).
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const DEMO_INTERNAL_URL = "http://demo.internal/sb";

export const demoFetch: typeof fetch = async (input, init) => {
  const { handleDemo } = await import("@/lib/demo/engine");
  const req = new Request(input as RequestInfo, init);
  return handleDemo(req, new URL(req.url).pathname.replace(/^\/sb/, ""));
};
