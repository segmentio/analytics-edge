import ElementHandler from "./parser";
import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import { Env } from "./types";
import { enrichResponseWithCookie, getCookie } from "./cookies";
import enrichWithAJS from "./parser";
import { extractProfile, handlePersonasWebhook } from "./personas";
import { handleAJS, handleBundles, handleSettings } from "./assetsProxy";

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

  private async getEdgeFunctions(env: Env) {
    const edgeFunctions = await env.EdgeFunctions.list({
      prefix: this.writeKey,
    });

    return edgeFunctions.keys
      .map((key: { name: string }) => key.name)
      .map((key: string) => key.replace(`${this.writeKey}-`, ""));
  }

  async handleTAPI(request: Request, env: Env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const method = parts.pop();
    let body: { [key: string]: any } = await request.json();

    const edgeFunctions = await this.getEdgeFunctions(env);

    for (const func of edgeFunctions) {
      let user_worker = env.dispatcher.get(func);
      console.log("invoking", func);
      const data = await user_worker.fetch(
        new Request(request.url, { body: JSON.stringify(body), method: "POST" })
      );
      body = await data.json();
    }

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

    const init = {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(body),
    };

    const resp = await fetch(`https://api.segment.io/v1/${method}`, init);

    return resp;
  }

  async handleSourceFunction(request: Request, env: Env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const method = parts.pop();

    let user_worker = env.dispatcher.get(method);
    console.log(user_worker);
    const data = await user_worker.fetch(request);

    const body = await data.json();
    return new Response(JSON.stringify(body));
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
        return this.handleTAPI(request, env);
      case "source-function":
        return this.handleSourceFunction(request, env);
      case "personas":
        return handlePersonasWebhook(request, env);
      default:
        return this.handleRoot(request, env);
    }
  }
}
