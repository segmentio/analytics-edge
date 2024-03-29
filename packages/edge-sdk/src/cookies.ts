import { v4 as uuidv4 } from "uuid";
import { parse as parseDomain } from "tldts";
import { parse, stringify } from "worktop/cookie";
import { HandlerFunction } from "./types";

export function getCookie(request: Request, key: string): string | undefined {
  return parse(request.headers.get("cookie") || "")[key];
}

export const enrichResponseWithIdCookies: HandlerFunction = async (
  request,
  response,
  context
) => {
  if (response.status !== 200) {
    return [request, response, context];
  }

  const host = context.host;
  const domain = getDomain(host);
  const anonymousId = context.anonymousId || uuidv4();
  const userId = context.userId;
  const headers = new Headers(response.headers);

  context.logger.log("debug", "Enriching response with cookies", {
    anonymousId: anonymousId,
    userId: userId,
  });

  const cookie = stringify("ajs_anonymous_id", anonymousId, {
    httponly: true,
    path: "/",
    maxage: 31536000,
    domain,
    samesite: "Lax",
  });
  headers.append("Set-Cookie", cookie);

  if (userId) {
    const cookie = stringify("ajs_user_id", userId, {
      httponly: true,
      path: "/",
      maxage: 31536000,
      domain,
      samesite: "Lax",
    });
    headers.append("Set-Cookie", cookie);
  }

  // required for CORS requests (when customer not using a full proxy, e.g.,
  // TAPI on segment.example.com and customer on example.com)
  headers.set("Access-Control-Allow-Credentials", "true");

  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const newContext = { ...context, anonymousId };
  return [request, newResponse, newContext];
};

export const resetCookies: HandlerFunction = async (
  request,
  response,
  context
) => {
  const headers = new Headers(response.headers);
  const domain = getDomain(context.host);
  const origin = request.headers.get("origin") || `https://${domain}`;

  headers.append(
    "Set-Cookie",
    stringify("ajs_anonymous_id", "", {
      httponly: true,
      path: "/",
      maxage: 0, // 🪦 ajs_anonymous_id
      domain,
      samesite: "Lax",
    })
  );
  headers.append(
    "Set-Cookie",
    stringify("ajs_user_id", "", {
      httponly: true,
      path: "/",
      maxage: 0, // 🪦 ajs_user_id
      domain,
      samesite: "Lax",
    })
  );
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Origin", origin);

  const newResponse = new Response("Success!", {
    status: 200,
    headers,
  });

  return [request, newResponse, context];
};

export const extractIdFromCookie: HandlerFunction = async (
  request,
  response,
  context
) => {
  const anonymousId = getCookie(request, "ajs_anonymous_id");
  const userId = getCookie(request, "ajs_user_id");
  const newContext = { ...context, anonymousId, userId };

  return [request, response, newContext];
};

export const extractIdFromPayload: HandlerFunction = async (
  request,
  response,
  context
) => {
  const body: { [key: string]: any } = await request.json();
  const newContext = { ...context };

  if (body.userId) {
    newContext.userId = body.userId;
  }

  if (body.anonymousId) {
    newContext.anonymousId = body.anonymousId;
  }

  return [
    new Request(request, { body: JSON.stringify(body) }),
    response,
    newContext,
  ];
};

const getDomain = (host: string): string => {
  const res = parseDomain(host);
  if (res.domain) {
    return res.domain;
  } else {
    return host;
  }
};
