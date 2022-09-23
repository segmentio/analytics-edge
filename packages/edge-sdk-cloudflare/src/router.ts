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

function generateRouteMatcher(basePath: string): [string, RegExp][] {
  return [
    ["settings", `/v1/projects/:writeKey/settings`],
    ["bundles", `/analytics-next/bundles/:bundleName`],
    ["destinations", `/next-integrations/*`],
    ["tapi", `/evs/:method`],
    ["source-function", `/sf/:function`],
    ["personas", `/personas`],
    ["ajs", `/ajs/:hash`],
    ["root", `/*`],
  ].map((i) => [
    i[0],
    RegExp(
      `^/${basePath}${i[1]
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
  routes: [string, RegExp][];
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

  getRoute(path: string): Route {
    for (const [route, matcher] of this.routes) {
      const match = matcher.exec(path);
      if (match) {
        const params = match.groups;
        return { route, params };
      }
    }
    return { route: "root", params: undefined };
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
    const originalRequest = request;
    const path = url.pathname;
    const { route, params } = this.getRoute(path);
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
