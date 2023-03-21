import { HandlerFunction } from "./types";

// Proxy AJS
export const handleAJS: HandlerFunction = async (request, response, ctx) => {
  const url = `${ctx.settings.baseSegmentCDN}/analytics.js/v1/${ctx.settings.writeKey}/analytics.min.js`;

  const resp = await fetch(url);
  return [request, resp, ctx];
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

// Injects the custom AJS calls (to configure identity/traits into the AJS bundle)
// TODO: Possibly break this into two calls so we can control client-side traits and server-side cookies separately
export const appendIdCallsToAJS: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  const { userId, anonymousId, clientSideTraits } = ctx;

  const anonymousCall = `${
    anonymousId ? `analytics.setAnonymousId("${anonymousId}");` : ""
  }`;

  // TODO: Switch to non-tracking call
  const idCall = `${
    userId && clientSideTraits
      ? `analytics.identify("${userId}", ${JSON.stringify(clientSideTraits)});`
      : userId
      ? `analytics.identify("${userId}");`
      : ""
  }`;

  const resetHandler = `analytics.on('reset', function() { fetch('https://${ctx.host}/${ctx.settings.routePrefix}/reset', {credentials:"include"}) });`;

  const content = await response.text();

  const body = `
    ${anonymousCall}${idCall}
    ${resetHandler}
    ${content}`;

  return [request, new Response(body, response), ctx];
};

// Configures AJS with the custom domain and other monkey patches
export const appendAJSCustomConfiguration: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  const host = ctx.host;

  const cdnConfiguration = `analytics._cdn = "https://${host}/${ctx.settings.routePrefix}";`;

  let content = await response.text();

  // TODO: this monkey-patch is hacky. We should probably address this directly in AJS codebase instead.
  // Sending (credentials:"include") is required to allow TAPI calls set cookies when TAPI and customer website are not on the same domain.
  // For example, TAPI on segment.example.com and customer website on example.com
  content = content.replace(
    /method:"post"/g,
    'method:"post",credentials:"include"'
  );

  const body = `
    ${cdnConfiguration}
    ${content}`;

  return [request, new Response(body, response), ctx];
};

export const redactWritekey: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  const content = await response.text();
  const body = content.replace(ctx.settings.writeKey, "REDACTED");

  return [request, new Response(body, response), ctx];
};

// get rid of 'missing sourcemaps' error
export const removeSourcemapReference: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }
  const content = await response.text();
  const body = content.replace(new RegExp("//#.*"), "");

  return [request, new Response(body, response), ctx];
};

export const configureApiHost: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  const host = ctx.host;
  // rather than send to api.segment.io, configure analytics to proxy event calls through worker.
  const settings = (await response.json()) as any;
  const apiHost = `${host}/${ctx.settings.routePrefix}/evs`;
  // we parse settings because of bug where apiHost is missing.
  settings.integrations["Segment.io"].apiHost = apiHost;
  settings.metrics.host = apiHost;
  return [request, new Response(JSON.stringify(settings), response), ctx];
};

export const handleCORS: HandlerFunction = async (request, response, ctx) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return [
    request,
    new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    }),
    ctx,
  ];
};
