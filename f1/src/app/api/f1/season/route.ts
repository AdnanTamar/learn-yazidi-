import { getSeasonData } from "@/server/season";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = () => respond(async () => { const { _stale, ...s } = await getSeasonData(); void _stale; return s; }, { sMaxAge: 60 });
