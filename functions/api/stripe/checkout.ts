import type { Env } from "../../../libs/utils";
import {
  onRequestGet as checkoutGet,
  onRequestPost as checkoutPost,
  onRequestOptions as checkoutOptions,
} from "../checkout";

/** Template-compatible alias: /api/stripe/checkout → /api/checkout */
export const onRequestOptions: PagesFunction<Env> = (ctx) => checkoutOptions(ctx);
export const onRequestGet: PagesFunction<Env> = (ctx) => checkoutGet(ctx);
export const onRequestPost: PagesFunction<Env> = (ctx) => checkoutPost(ctx);
