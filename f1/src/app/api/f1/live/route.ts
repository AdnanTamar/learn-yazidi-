import { getLive } from "@/server/live";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";
export const GET = () => respond(getLive, "no-store");
