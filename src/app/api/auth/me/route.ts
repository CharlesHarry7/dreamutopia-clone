export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestGet, onRequestOptions } from "@/server/handlers/api/auth/me";

export const GET = adapt(onRequestGet);
export const OPTIONS = adapt(onRequestOptions);
