import { json } from "../../libs/utils";

export const onRequestGet = (): Response => json({ ok: true, service: "dreamutopia-clone", time: Date.now() });

export const onRequestOptions = (): Response => new Response(null, { status: 204 });
