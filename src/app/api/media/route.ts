export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestGet, onRequestHead, onRequestOptions } from "@/server/handlers/api/media";

export const GET = adapt(onRequestGet);
export const HEAD = adapt(onRequestHead);
export const OPTIONS = adapt(onRequestOptions);
