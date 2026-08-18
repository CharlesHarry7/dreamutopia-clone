import type { Env } from "../../libs/utils";
import { json, workerExceptionJson } from "../../libs/utils";
import {
  onRequestGet as generateGet,
  onRequestPost as generatePost,
  onRequestHead as generateHead,
  onRequestOptions as generateOptions,
} from "./generate";

/** Alias of GET /api/history — generate history JSON (never SPA HTML). */
export const onRequestOptions: PagesFunction<Env> = (ctx) => generateOptions(ctx);
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    return await generateGet(ctx);
  } catch {
    return workerExceptionJson("Could not load history. Please try again.");
  }
};
export const onRequestHead: PagesFunction<Env> = async (ctx) => {
  try {
    return await generateHead(ctx);
  } catch {
    return workerExceptionJson("Could not load history. Please try again.");
  }
};
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    return await generatePost(ctx);
  } catch {
    return workerExceptionJson("Generation failed. Please try again.");
  }
};
export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const method = ctx.request.method;
    if (method === "HEAD") return onRequestHead(ctx);
    if (method === "OPTIONS") return onRequestOptions(ctx);
    if (method === "GET") return onRequestGet(ctx);
    if (method === "POST") return onRequestPost(ctx);
    return json({ error: "method_not_allowed", code: "method_not_allowed" }, 405);
  } catch {
    return workerExceptionJson("Could not load history. Please try again.");
  }
};
