export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestPost, onRequestOptions } from "@/server/handlers/api/auth/login";

export const POST = adapt(onRequestPost);
export const OPTIONS = adapt(onRequestOptions);
