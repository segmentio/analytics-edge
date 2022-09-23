import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { HandlerFunction } from "./types";

export function getCookie(request: Request, key: string): string | undefined {
  return parse(request.headers.get("cookie") || "")[key];
}

export function enrichResponseWithCookie(
  key: string,
  host: string | undefined
): HandlerFunction {
  return async (request, response, context) => {
    if (!response) {
      return Promise.reject("No response");
    }

    const value = getCookie(request, key) || nanoid();

    const newResponse = new Response(response.body, response);
    const cookie = stringify(key, value, {
      httponly: true,
      path: "/",
      maxage: 31536000,
      domain: host,
    }); // TODO: maybe append to existing cookie?
    newResponse.headers.set("set-cookie", cookie);
    const newContext = { ...context, anonymousId: value };
    return [request, newResponse, newContext];
  };
}
