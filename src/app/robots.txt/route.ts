export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { adapt } from "@/server/cf";
import { onRequestGet } from "@/server/handlers/robots.txt";

export const GET = adapt(onRequestGet);
