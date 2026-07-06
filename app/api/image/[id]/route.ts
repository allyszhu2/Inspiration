import {
  checkPasscode,
  getImage,
  isValidId,
  isValidKind,
  putImage,
  storeMode,
} from "@/lib/server/store";

function validate(req: Request, id: string): Response | { kind: "full" | "thumb" } {
  if (!checkPasscode(req)) {
    return Response.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (storeMode() === "none") {
    return Response.json({ error: "Sync isn’t configured" }, { status: 503 });
  }
  const kind = new URL(req.url).searchParams.get("kind") ?? "full";
  if (!isValidId(id) || !isValidKind(kind)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  return { kind };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const v = validate(req, id);
  if (v instanceof Response) return v;

  const image = await getImage(id, v.kind);
  if (!image) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const v = validate(req, id);
  if (v instanceof Response) return v;

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > 8 * 1024 * 1024) {
    return Response.json({ error: "Bad image" }, { status: 400 });
  }
  await putImage(id, v.kind, data, req.headers.get("content-type") || "image/jpeg");
  return Response.json({ ok: true });
}
