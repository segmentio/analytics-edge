import { HandlerFunction } from "./types";

// Proxy AJS
export const handleAJS: HandlerFunction = async (request, response, ctx) => {
  const url = `${ctx.settings.baseSegmentCDN}/analytics.js/v1/${ctx.settings.writeKey}/analytics.min.js`;
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

  const { userId, anonymousId, clientSideTraits } = ctx;

  const anonymousCall = `${
    anonymousId ? `analytics.setAnonymousId("${anonymousId}");` : ""
  }`;

  const idCall = `${
    userId && clientSideTraits
      ? `analytics.identify("${userId}", ${JSON.stringify(clientSideTraits)});`
      : userId
      ? `analytics.identify("${userId}");`
      : ""
  }`;

  const content = await response.text();
  const body = `
    ${anonymousCall}
    ${idCall}
    ${content}`;

  return [request, new Response(body, { ...response }), ctx];
};

// Proxy Settings
export const handleSettings: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  const url = `${ctx.settings.baseSegmentCDN}/v1/projects/${ctx.settings.writeKey}/settings`;
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
  const path = url.pathname.replace(`/${ctx.settings.routePrefix}/`, "/");
  const target = `${ctx.settings.baseSegmentCDN}${path}`;
  const resp = await fetch(target);
  return [request, resp, ctx];
};

export const redactWritekey: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (!response) {
    return [request, response, ctx];
  }

  const content = await response.text();
  const body = content.replace(ctx.settings.writeKey, "REDACTED");
  return [request, new Response(body, { ...response }), ctx];
};
