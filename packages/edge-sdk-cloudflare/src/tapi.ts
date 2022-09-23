import { Env, HandlerFunction } from "./types";

export const handleEdgeFunctions: HandlerFunction = async (
  request,
  response,
  context
) => {
  let body: { [key: string]: any } = await request.json();
  const writeKey = context.instance.writeKey;
  // getting edge functions
  const edgeFunctions = await context.env.EdgeFunctions.list({
    prefix: writeKey,
  });

  const edgePointers = edgeFunctions.keys
    .map((key: { name: string }) => key.name)
    .map((key: string) => key.replace(`${writeKey}-`, ""));

  for (const func of edgePointers) {
    let user_worker = context.env.dispatcher.get(func);
    console.log("invoking", func);
    const data = await user_worker.fetch(
      new Request(request.url, { body: JSON.stringify(body), method: "POST" })
    );
    body = await data.json();
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

export const enrichEdgeTraits: HandlerFunction = async (
  request,
  response,
  context
) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const method = parts.pop();
  let body: { [key: string]: any } = await request.json();
  if (method === "i" && request.cf) {
    body.traits = {
      ...body.traits,
      edge: {
        region: request.cf.region,
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

  const init = {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  };

  const resp = await fetch(`https://api.segment.io/v1/${method}`, init);

  return [request, resp, context];
};
