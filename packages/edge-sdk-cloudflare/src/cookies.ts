import { parse, stringify } from "worktop/cookie";

export function getCookie(request: Request, key: string): string | undefined {
  return parse(request.headers.get("cookie") || "")["key"];
}

export function enrichResponseWithCookie(
  response: Response,
  key: string,
  value: string,
  host: string | undefined
): Response {
  const newResponse = new Response(response.body, response);
  const cookie = stringify(key, value, {
    httponly: true,
    path: "/",
    maxage: 31536000,
    domain: host,
  });
  newResponse.headers.set("set-cookie", cookie);
  return newResponse;
}
