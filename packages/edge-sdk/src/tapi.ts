import { HandlerFunction } from "./types";
import { version } from "./generated/version";

export const includeEdgeTraitsInContext: HandlerFunction = async (
  request,
  response,
  context
) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const method = parts.pop();
  const body: { [key: string]: any } = await request.json();
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

  const resp = await fetch(
    `${context.settings.trackingApiEndpoint}/${method}`,
    request
  );

  return [request, resp, context];
};

export const injectMetadata: HandlerFunction = async (
  request,
  response,
  context
) => {
  const body = (await request.json()) as any;
  body._metadata = {
    ...body._metadata,
    jsRuntime: "cloudflare-worker",
  };
  body.context = {
    ...body.context,
    library: {
      ...body.context?.library,
      name: "analytics-edge",
      version,
    },
  };
  return [
    new Request(request, { body: JSON.stringify(body) }),
    response,
    context,
  ];
};

export const injectWritekey: HandlerFunction = async (
  request,
  response,
  context
) => {
  // grab body and method from request
  const body: { [key: string]: any } = await request.json();

  // discard the redacted writekey and include the real one in the headers
  const headers = new Headers(request.headers);
  headers.append(
    "Authorization",
    `Basic ${btoa(`${context.settings.writeKey}:`)}`
  );
  delete body.writeKey;

  // create a new request
  const init: RequestInit = {
    method: request.method,
    headers,
    body: JSON.stringify(body),
    cf: request.cf as RequestInitCfProperties,
  };

  return [new Request(request.url, init), response, context];
};
