import type { Env } from "../../libs/utils";
import {
  onRequestGet as generateGet,
  onRequestPost as generatePost,
  onRequestHead as generateHead,
  onRequestOptions as generateOptions,
} from "./generate";

/** Template-compatible alias: /api/jobs → /api/generate (JSON, never SPA/404 HTML). */
export const onRequestOptions: PagesFunction<Env> = (ctx) => generateOptions(ctx);
export const onRequestGet: PagesFunction<Env> = (ctx) => generateGet(ctx);
export const onRequestHead: PagesFunction<Env> = (ctx) => generateHead(ctx);
export const onRequestPost: PagesFunction<Env> = (ctx) => generatePost(ctx);
