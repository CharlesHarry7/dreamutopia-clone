import type { Env } from "../../libs/utils";
import { workerExceptionJson } from "../../libs/utils";
import {
  onRequestGet as generateGet,
  onRequestPost as generatePost,
  onRequestHead as generateHead,
  onRequestOptions as generateOptions,
} from "./generate";

/** Real Pages Function file: GET /api/history → generate history JSON (never SPA HTML). */
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
