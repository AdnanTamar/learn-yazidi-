import { getRaceDetail } from "@/server/race";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = (_: Request, { params }: { params: Promise<{ round: string }> }) =>
  respond(async () => getRaceDetail(Number((await params).round)), { sMaxAge: 30 });
