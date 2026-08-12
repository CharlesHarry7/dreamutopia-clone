export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestPost } from "@/server/handlers/api/webhooks/kie";

export const POST = adapt(onRequestPost);
