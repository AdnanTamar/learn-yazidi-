import { getDriverProfile } from "@/server/driver";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = (_: Request, { params }: { params: Promise<{ id: string }> }) =>
  respond(async () => getDriverProfile((await params).id), { sMaxAge: 300 });
