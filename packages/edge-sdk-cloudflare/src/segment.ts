import ElementHandler from "./parser";
import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import { Env } from "./types";
import { enrichResponseWithCookie, getCookie } from "./cookies";
import enrichWithAJS from "./parser";
import { extractProfile, handlePersonasWebhook } from "./personas";
import { handleAJS, handleBundles, handleSettings } from "./assetsProxy";
import { handleTAPI } from "./tapi";
import { handleSourceFunction } from "./sourceFunction";

const baseSegment = "https://cdn.segment.com";

export class Segment {
  writeKey: string;
  basePath: string;
  collectEdgeData: boolean;
  personasSpaceId: string | undefined;
  personasToken: string | undefined;
  router: Router;

  constructor(
    writeKey: string,
    basePath: string = "segment",
    collectEdgeData = true,
    personasSpaceId?: string,
    personasToken?: string
  ) {
    this.writeKey = writeKey;
    this.basePath = basePath;
    this.collectEdgeData = collectEdgeData;
    this.personasSpaceId = personasSpaceId;
    this.personasToken = personasToken;
    this.router = new Router(this.basePath);
  }

  async handleRoot(request: Request, env: Env) {
    const host = request.headers.get("host") || ""; // can this be null?
    const anonymousId = getCookie(request, "ajs_anonymous_id") || nanoid();

    const profileObject = await extractProfile(
      request,
      env.Profiles,
      {
        userId: getCookie(request, "ajs_user_id"),
        anonymousId,
      },
      this.personasSpaceId,
      this.personasToken
    );

    const traits = profileObject?.traits;

    let resp = await fetch(request);

    resp = enrichResponseWithCookie(
      resp,
      "ajs_anonymous_id",
      anonymousId,
      host || undefined
    );

    return enrichWithAJS(
      resp,
      host,
      this.writeKey,
      this.basePath,
      anonymousId,
      traits
    );
  }

  async handle(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const { route } = this.router.getRoute(path);
    switch (route) {
      case "ajs":
        return handleAJS(request, this.writeKey);
      case "settings":
        return handleSettings(request, this.writeKey);
      case "bundles":
      case "destinations":
        return handleBundles(request, this.basePath);
      case "tapi":
        return handleTAPI(request, env, this.writeKey);
      case "source-function":
        return handleSourceFunction(request, env);
      case "personas":
        return handlePersonasWebhook(request, env);
      default:
        return this.handleRoot(request, env);
    }
  }
}
