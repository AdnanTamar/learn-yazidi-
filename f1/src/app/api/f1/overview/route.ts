import { getOverview } from "@/server/overview";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";
export const GET = () => respond(async () => { const { _stale, _asOf, ...o } = await getOverview(); void _stale; void _asOf; return o; }, { sMaxAge: 30 });
