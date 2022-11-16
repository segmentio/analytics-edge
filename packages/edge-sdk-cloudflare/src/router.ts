import { Segment } from "./segment";
import { RouterContext, Env, HandlerFunction } from "./types";

interface Route {
  route: EdgeSDKKnownRoutes;
  params:
    | {
        [key: string]: string;
      }
    | undefined;
}

type Method = "get" | "post" | "put" | "delete" | "patch";
export type EdgeSDKKnownRoutes =
  | "settings"
  | "bundles"
  | "destinations"
  | "tapi"
  | "personas"
  | "root"
  | "ajs"
  | "bypass";

export class Router {
  routePrefix: string;
  routes: [Method, EdgeSDKKnownRoutes, RegExp][];
  handlers: {
    [key: string]: HandlerFunction[];
  };
  defaultRouterContext: RouterContext;

  constructor(routePrefix: string, defaultRouterContext: RouterContext) {
    this.routePrefix = routePrefix;
    this.routes = this.generateRouteMatcher(routePrefix);
    this.handlers = {};
    this.defaultRouterContext = defaultRouterContext;
  }

  private generateRouteMatcher(
    routePrefix: string
  ): [Method, EdgeSDKKnownRoutes, RegExp][] {
    const rawRoutes: [Method, EdgeSDKKnownRoutes, string][] = [
      ["get", "settings", `${routePrefix}/v1/projects/:writeKey/settings`],
      ["get", "bundles", `${routePrefix}/analytics-next/bundles/:bundleName`],
      ["get", "destinations", `${routePrefix}/next-integrations/*`],
      ["post", "tapi", `${routePrefix}/evs/:method`],
      ["post", "personas", `${routePrefix}/personas`],
      ["get", "ajs", `${routePrefix}/ajs/:hash`],
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

  private matchRoute(path: string, method: Method): Route {
    for (const [httpMethod, route, matcher] of this.routes) {
      if (httpMethod !== method) {
        continue;
      }

      const match = matcher.exec(path);
      if (match) {
        const params = match.groups;
        return { route, params };
      }
    }

    // bypass route i.e., proxy to origin
    return { route: "bypass", params: undefined };
  }

  register(route: EdgeSDKKnownRoutes, ...handlers: HandlerFunction[]) {
    if (!this.handlers[route]) {
      this.handlers[route] = [];
    }
    this.handlers[route].push(...handlers);

    return {
      handler: (handler: HandlerFunction, condition: boolean = true) => {
        return condition ? this.register(route, handler) : this.register(route);
      },
    };
  }

  async handle(
    request: Request
  ): Promise<[Request, Response | undefined, RouterContext]> {
    const url = new URL(request.url);
    const method = request.method.toLowerCase() as Method;
    const originalRequest = request;
    const path = url.pathname;
    const { route, params } = this.matchRoute(path, method);
    const handlers = this.handlers[route];
    let response: Response | undefined = undefined;
    let context: RouterContext = {
      ...this.defaultRouterContext,
      params,
    };

    if (!handlers) {
      return Promise.reject("No handlers for route");
    }

    context.logger.log(
      "debug",
      `Executing ${handlers.length} handlers for route: ${route}`
    );

    for (const handler of handlers) {
      [request, response, context] = await handler(request, response, context);

      // if a handler sets earlyExit to true, we stop executing handlers
      if (context.earlyExit) {
        break;
      }
    }

    return [request, response, context];
  }
}
