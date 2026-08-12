export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestGet, onRequestOptions } from "@/server/handlers/api/upload-ticket";

export const GET = adapt(onRequestGet);
export const OPTIONS = adapt(onRequestOptions);
