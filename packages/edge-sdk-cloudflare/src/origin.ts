import { HandlerFunction } from "./types";

export const handleOrigin: HandlerFunction = async (request, response, ctx) => {
  if (response) {
    return [request, response, ctx];
  } else {
    const resp = await fetch(request);
    return [request, resp, ctx];
  }
};

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
    const resp = await fetch(request);
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
