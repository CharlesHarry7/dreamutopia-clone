export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestPost } from "@/server/handlers/api/stripe/webhook";

export const POST = adapt(onRequestPost);
