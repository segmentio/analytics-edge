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
      `^${basePath}${i[1]
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

  constructor(basePath: string) {
    this.basePath = basePath;
    this.routes = generateRouteMatcher(basePath);
    console.log(this.routes);
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
}
