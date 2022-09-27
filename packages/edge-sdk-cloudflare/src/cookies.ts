import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { HandlerFunction } from "./types";

export function getCookie(request: Request, key: string): string | undefined {
  return parse(request.headers.get("cookie") || "")[key];
}

export function enrichResponseWithIdCookies(
  host: string | undefined
): HandlerFunction {
  return async (request, response, context) => {
    if (!response) {
      return Promise.reject("No response");
    }
    const anonymousId = context.anonymousId || nanoid();
    const userId = context.userId;

    const newResponse = new Response(response.body, response);

    const cookie = stringify("ajs_anonymous_id", anonymousId, {
      httponly: true,
      path: "/",
      maxage: 31536000,
      domain: host,
    });
    newResponse.headers.set("set-cookie", cookie);

    if (userId) {
      const cookie = stringify("ajs_user_id", userId, {
        httponly: true,
        path: "/",
        maxage: 31536000,
        domain: host,
      });
      newResponse.headers.set("set-cookie", cookie);
    }

    const newContext = { ...context, anonymousId };
    return [request, newResponse, newContext];
  };
}

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
  let body: { [key: string]: any } = await request.json();
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
