import { HandlerFunction } from "./types";

// Proxy AJS
export const handleAJS: HandlerFunction = async (request, response, ctx) => {
  const url = `${ctx.instance.baseSegment}/analytics.js/v1/${ctx.instance.writeKey}/analytics.min.js`;
  const resp = await fetch(url);
  return [request, resp, ctx];
};

export const enrichAssetWithAJSCalls: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (!response) {
    return [request, response, ctx];
  }

  const { userId, anonymousId } = ctx;

  const anonymousCall = `${
    anonymousId ? `analytics.setAnonymousId("${anonymousId}");` : ""
  }`;

  const idCall = `${userId ? `analytics.identify("${userId}");` : ""}`;

  const content = await response.text();
  const body = `
    ${anonymousCall}
    ${idCall}
    ${content}`;

  const init = {
    headers: response?.headers,
    status: response?.status,
    statusText: response?.statusText,
  };

  return [request, new Response(body, init), ctx];
};

// Proxy Settings
export const handleSettings: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  const url = `${ctx.instance.baseSegment}/v1/projects/${ctx.instance.writeKey}/settings`;
  const resp = await fetch(url);
  return [request, resp, ctx];
};

// Proxy Bundles
export const handleBundles: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(`/${ctx.instance.basePath}/`, "/");
  const target = `${ctx.instance.baseSegment}${path}`;
  const resp = await fetch(target);
  return [request, resp, ctx];
};
