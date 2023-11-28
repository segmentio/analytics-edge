import { fetchWithSettings } from "./fetchWithSettings";
import { getReplacementStream } from "./getReplacementStream";
import { HandlerFunction } from "./types";

const DEFAULT_PROTOCOL = 'https';

// Proxy AJS
export const handleAJS: HandlerFunction = async (request, response, ctx) => {
  const url = `${ctx.settings.baseSegmentCDN}/analytics.js/v1/${ctx.settings.writeKey}/analytics.min.js`;

  const resp = await fetchWithSettings(url, undefined, { fastly: { backend: ctx.settings.fastly?.segmentCdnBackend } })
  return [request, resp, ctx];
};

// Proxy Settings
export const handleSettings: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  const url = `${ctx.settings.baseSegmentCDN}/v1/projects/${ctx.settings.writeKey}/settings`;
  const resp = await fetchWithSettings(url, undefined, { fastly: { backend: ctx.settings.fastly?.segmentCdnBackend } })
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
  const resp = await fetchWithSettings(target, undefined, { fastly: { backend: ctx.settings.fastly?.segmentCdnBackend } })
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

  const anonymousCall = `${anonymousId ? `analytics.setAnonymousId("${anonymousId}");` : ""
    }`;

  // TODO: Switch to non-tracking call
  const idCall = `${userId && clientSideTraits
      ? `analytics.identify("${userId}", ${JSON.stringify(clientSideTraits)});`
      : userId
        ? `analytics.identify("${userId}");`
        : ""
    }`;

  const resetHandler = `analytics.on('reset', function() { fetch('${ctx.settings.experimental?.protocol ?? DEFAULT_PROTOCOL}://${ctx.host}/${ctx.settings.routePrefix}/reset', {credentials:"include"}) });`;

  const content = `
    ${anonymousCall}${idCall}
    ${resetHandler}`;

  let modifiedResponse = response;
  if (response.body && !response.bodyUsed) {
    const modifiedContent = response.body.pipeThrough(getReplacementStream({
      prependContent: content
    }));

    modifiedResponse = new Response(modifiedContent, response);
  }

  return [request, modifiedResponse, ctx];
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

  const cdnConfiguration = `analytics._cdn = "${ctx.settings.experimental?.protocol ?? DEFAULT_PROTOCOL}://${host}/${ctx.settings.routePrefix}";`;

  let modifiedResponse = response;
  if (response.body && !response.bodyUsed) {
    const modifiedContent = response.body.pipeThrough(getReplacementStream({
      prependContent: cdnConfiguration,
      replacer(content) {
        // TODO: this monkey-patch is hacky. We should probably address this directly in AJS codebase instead.
        // Sending (credentials:"include") is required to allow TAPI calls set cookies when TAPI and customer website are not on the same domain.
        // For example, TAPI on segment.example.com and customer website on example.com
        return content.replace(
          /method:"post"/g,
          'method:"post",credentials:"include"'
        );
      }
    }));
    modifiedResponse = new Response(modifiedContent, response);
  }

  return [request, modifiedResponse, ctx];
};

export const redactWritekey: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  if (response.status !== 200) {
    return [request, response, ctx];
  }

  let modifiedResponse = response;
  if (response.body && !response.bodyUsed) {
    const modifiedContent = response.body.pipeThrough(getReplacementStream({
      replacer(content) {
        return content.replace(ctx.settings.writeKey, "REDACTED")
      }
    }));
    modifiedResponse = new Response(modifiedContent, response);
  }

  return [request, modifiedResponse, ctx];
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

  let modifiedResponse = response;
  if (response.body && !response.bodyUsed) {
    const modifiedContent = response.body.pipeThrough(getReplacementStream({
      replacer(content) {
        return content.replace(new RegExp("//#.*"), "");
      }
    }));
    modifiedResponse = new Response(modifiedContent, response);
  }

  return [request, modifiedResponse, ctx];
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
  const apiHost = `${host}/${ctx.settings.routePrefix}/evs`;

  let modifiedResponse = response;
  if (response.body && !response.bodyUsed) {
    const modifiedContent = response.body.pipeThrough(getReplacementStream({
      replacer(content) {
        const settings = JSON.parse(content);
        // we parse settings because of bug where apiHost is missing.
        settings.integrations["Segment.io"].apiHost = apiHost;
        settings.metrics.host = apiHost;
        if (ctx.settings.experimental?.protocol) {
          settings.integrations['Segment.io'].protocol = ctx.settings.experimental.protocol;
        }
        return JSON.stringify(settings);
      }
    }));
    modifiedResponse = new Response(modifiedContent, response);
  }

  return [request, modifiedResponse, ctx];
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
