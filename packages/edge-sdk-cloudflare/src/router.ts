import { Segment } from "./segment";
import { RouterContext, Env, HandlerFunction } from "./types";

interface Route {
  route: string;
  params:
    | {
        [key: string]: string;
      }
    | undefined;
}

type Method = "get" | "post" | "put" | "delete" | "patch";

function generateRouteMatcher(basePath: string): [Method, string, RegExp][] {
  const rawRoutes: [Method, string, string][] = [
    ["get", "settings", `${basePath}/v1/projects/:writeKey/settings`],
    ["get", "bundles", `${basePath}/analytics-next/bundles/:bundleName`],
    ["get", "destinations", `${basePath}/next-integrations/*`],
    ["post", "tapi", `${basePath}/evs/:method`],
    ["get", "source-function", `${basePath}/sf/:function`],
    ["post", "personas", `${basePath}/personas`],
    ["get", "ajs", `${basePath}/ajs/:hash`],
    ["get", "root", `*`],
  ];

  return rawRoutes.map((i) => [
    i[0],
    i[1],
    RegExp(
      `^/${i[2]
        .replace(/(\/?)\*/g, "($1.*)?") // trailing wildcard
        .replace(/\/$/, "") // remove trailing slash
        .replace(/:(\w+)(\?)?(\.)?/g, "$2(?<$1>[^/]+)$2$3") // named params
        .replace(/\.(?=[\w(])/, "\\.") // dot in path
        .replace(/\)\.\?\(([^\[]+)\[\^/g, "?)\\.?($1(?<=\\.)[^\\.")}/*$`
    ),
  ]);
}

export class Router {
  basePath: string;
  routes: [Method, string, RegExp][];
  handlers: {
    [key: string]: HandlerFunction[];
  };
  env: Env;
  instance: Segment;

  constructor(basePath: string, env: Env, instance: Segment) {
    this.basePath = basePath;
    this.routes = generateRouteMatcher(basePath);
    this.handlers = {};
    this.env = env;
    this.instance = instance;
  }

  getRoute(path: string, method: string): Route {
    for (const [httpMethod, route, matcher] of this.routes) {
      console.log("matching", httpMethod, route, matcher, path, method);
      if (httpMethod !== method) {
        continue;
      }

      const match = matcher.exec(path);
      if (match) {
        const params = match.groups;
        return { route, params };
      }
    }

    return { route: "bypass", params: undefined };
  }

  register(route: string, ...handlers: HandlerFunction[]) {
    if (!this.handlers[route]) {
      this.handlers[route] = [];
    }
    this.handlers[route].push(...handlers);
  }

  async handle(
    request: Request
  ): Promise<[Request, Response | undefined, any]> {
    const url = new URL(request.url);
    const method = request.method.toLowerCase() as Method;
    const originalRequest = request;
    const path = url.pathname;
    const { route, params } = this.getRoute(path, method);
    const handlers = this.handlers[route];
    let response: Response | undefined = undefined;
    let context: RouterContext = {
      instance: this.instance,
      env: this.env,
    };

    if (!handlers) {
      return Promise.reject("No handlers for route");
    }

    try {
      for (const handler of handlers) {
        [request, response, context] = await handler(
          request,
          response,
          context
        );
      }

      return [request, response, context];
    } catch (e) {
      return [originalRequest, await fetch(originalRequest), context];
    }
  }
}
