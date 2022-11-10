import { Env, HandlerFunction } from "./types";

export const includeEdgeTraitsInContext: HandlerFunction = async (
  request,
  response,
  context
) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const method = parts.pop();
  let body: { [key: string]: any } = await request.json();
  if (method && ["i", "t", "p"].includes(method) && request.cf) {
    body.context = {
      ...body.context,
      edge: {
        region: request.cf.region,
        regionCode: request.cf.regionCode,
        city: request.cf.city,
        country: request.cf.country,
        continent: request.cf.continent,
        postalCode: request.cf.postalCode,
        latitude: request.cf.latitude,
        longitude: request.cf.longitude,
        timezone: request.cf.timezone,
      },
    };
  }
  return [
    new Request(request.url, {
      body: JSON.stringify(body),
      headers: request.headers,
      cf: request.cf as RequestInitCfProperties,
      method: request.method,
    }),
    response,
    context,
  ];
};

export const handleTAPI: HandlerFunction = async (
  request,
  response,
  context
) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const method = parts.pop();
  let body: { [key: string]: any } = await request.json();

  const init: RequestInit = {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  };

  const resp = await fetch(`https://api.segment.io/v1/${method}`, init);

  return [request, resp, context];
};
