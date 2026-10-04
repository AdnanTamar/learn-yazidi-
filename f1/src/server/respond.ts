import { NextResponse } from "next/server";

type Cache = "no-store" | { sMaxAge: number };

/** Uniform JSON responses: payload on success, `{ error }` with 502 when no data could be obtained at all. */
export async function respond<T>(fn: () => Promise<T | null>, cache: Cache): Promise<NextResponse> {
  try {
    const body = await fn();
    if (body === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(body, {
      headers: { "Cache-Control": cache === "no-store" ? "no-store" : `public, s-maxage=${cache.sMaxAge}, stale-while-revalidate=${cache.sMaxAge * 2}` },
    });
  } catch (e) {
    return NextResponse.json({ error: "upstream_unavailable", message: (e as Error).message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
