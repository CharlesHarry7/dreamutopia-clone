export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestGet, onRequestPost, onRequestOptions } from "@/server/handlers/api/gallery";

export const GET = adapt(onRequestGet);
export const POST = adapt(onRequestPost);
export const OPTIONS = adapt(onRequestOptions);
