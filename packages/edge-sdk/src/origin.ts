import { fetchWithSettings } from "./fetchWithContext";
import { HandlerFunction } from "./types";

export const handleOrigin: HandlerFunction = async (request, response, ctx) => {
  if (response && response.status === 200) {
    return [request, response, ctx];
  } else {
    const resp = await fetchWithSettings(request, undefined, {fastly: { backend: ctx.settings.fastly?.websiteOriginBackend}});
    return [request, resp, ctx];
  }
};

/* doesn't run the normal chain of handlers for requests to the origin unless:
 * 1- thre is a variation defined on the route or
 * 2- the content is HTML
 */
export const handleOriginWithEarlyExit: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  const url = new URL(request.url);
  if (ctx.variations && ctx.variations.find((e) => e.route === url.pathname)) {
    // experiment setup on the route, keep going through the pipeline
    return [request, response, ctx];
  } else {
    const resp = await fetchWithSettings(request, undefined, {fastly: { backend: ctx.settings.fastly?.websiteOriginBackend}});
    if (
      resp.status === 200 &&
      resp.headers.get("content-type")?.startsWith("text/html")
    ) {
      // html response, keep going through the pipeline
      return [request, resp, ctx];
    } else {
      // not html, return the response
      return [request, resp, { ...ctx, earlyExit: true }];
    }
  }
};

export const handleWith404: HandlerFunction = async (
  request,
  response,
  ctx
) => {
  return [
    request,
    new Response("Not Found", {
      status: 404,
    }),
    ctx,
  ];
};
