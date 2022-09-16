import ElementHandler from "./parser";
import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "worktop";

import { Env } from "./env";

const baseSegment = "https://cdn.segment.com";

export class Segment {
  writeKey: string;
  basePath: string;
  collectEdgeData: boolean;
  personasSpaceId: string | undefined;
  personasToken: string | undefined;

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
  }

  private async getEdgeFunctions(env: Env) {
    const edgeFunctions = await env.EdgeFunctions.list({
      prefix: this.writeKey,
    });

    return edgeFunctions.keys
      .map((key: { name: string }) => key.name)
      .map((key: string) => key.replace(`${this.writeKey}-`, ""));
  }

  private addCookie(response: Response, cookie: string) {
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("set-cookie", cookie);
    return newResponse;
  }

  private getAnonymousIdCookie(request: Request) {
    const cookie = parse(request.headers.get("cookie") || "");
    let anonymousId;

    if (cookie["ajs_anonymous_id"]) {
      anonymousId = cookie["ajs_anonymous_id"];
    } else {
      anonymousId = nanoid();
    }

    const respCookie = stringify("ajs_anonymous_id", anonymousId, {
      httponly: true,
      path: "/",
      maxage: 31536000,
      domain: `.${request.headers.get("host")}` || undefined, // todo: better logic for this
    });

    return [respCookie, anonymousId];
  }

  determineURLType(url: string) {
    if (url.startsWith(`/${this.basePath}/v1/projects`)) {
      return "settings";
    } else if (
      url.startsWith(`/${this.basePath}/analytics-next`) ||
      url.startsWith(`/${this.basePath}/next-integrations`)
    ) {
      return "bundles";
    } else if (url.startsWith(`/${this.basePath}/evs`)) {
      return "tapi";
    } else if (url.startsWith(`/${this.basePath}/sf`)) {
      return "source-function";
    } else if (url.startsWith(`/${this.basePath}/personas`)) {
      return "personas";
    } else if (url.startsWith(`/${this.basePath}`)) {
      return "ajs";
    } else return "root";
  }

  async handleAJS(request: Request) {
    const url = `${baseSegment}/analytics.js/v1/${this.writeKey}/analytics.min.js`;
    const resp = await fetch(url);
    return resp;
  }

  async handleSettings(request: Request) {
    const url = `${baseSegment}/v1/projects/${this.writeKey}/settings`;
    const resp = await fetch(url);
    return resp;
  }

  async handleBundles(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(`/${this.basePath}/`, "/");
    const target = `${baseSegment}${path}`;
    const resp = await fetch(target);
    return resp;
  }

  async handlePersonas(request: Request, env: Env) {
    let event: { [key: string]: any } = await request.json();

    if (event.type !== "identify") {
      return new Response("", { status: 200 });
    }

    const {
      userId,
      traits,
      context: { personas: personas },
    } = event;

    const profile_index = `${userId}`;

    const rawProfileData = await env.Profiles.get(profile_index);
    const profileData = rawProfileData ? JSON.parse(rawProfileData) : {};

    delete traits.user_id;
    const updatedProfile =
      personas.computation_class === "audience"
        ? {
            ...profileData,
            audiences: { ...(profileData.audiences || {}), ...traits },
          }
        : {
            ...profileData,
            traits: { ...(profileData.traits || {}), ...traits },
          };

    await env.Profiles.put(profile_index, JSON.stringify(updatedProfile));
    return new Response(`${personas.computation_class} updated`, {
      status: 200,
    });
  }

  async handleTAPI(request: Request, env: Env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const method = parts.pop();
    let body: { [key: string]: any } = await request.json();

    const edgeFunctions = await this.getEdgeFunctions(env);
    console.log(edgeFunctions);

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

  async extractProfile(
    request: Request,
    env: Env
  ): Promise<{ [key: string]: any }> {
    const [anonymousIdCookie, anonymousId] = this.getAnonymousIdCookie(request);

    const userId = parse(request.headers.get("cookie") || "")["ajs_user_id"];

    const profile_index = userId
      ? `user_id:${userId}`
      : `anonymous_id:${anonymousId}`;

    const profileData = await env.Profiles.get(profile_index);
    let profileObject = {};

    if (!profileData) {
      if (this.personasToken && this.personasSpaceId) {
        const data = await fetch(
          `https://profiles.segment.com/v1/spaces/${this.personasSpaceId}/collections/users/profiles/${profile_index}/traits`,
          {
            method: "GET",
            headers: {
              Authorization: "Basic " + btoa(`${this.personasToken}:`),
            },
          }
        );

        if (data.status === 200) {
          profileObject = await data.json();
          await env.Profiles.put(profile_index, JSON.stringify(profileObject), {
            expirationTtl: 120,
          });
          console.log(`reading prfile from API ${profile_index}`);
        }
      }
    } else {
      profileObject = JSON.parse(profileData);
      console.log(`reading from cache ${profile_index}`);
    }
    return profileObject;
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
    const [anonymousIdCookie, anonymousId] = this.getAnonymousIdCookie(request);

    const profileObject = await this.extractProfile(request, env);
    const traits = profileObject?.traits;
    console.log("traits:", traits);

    let resp = await fetch(request);

    resp = this.addCookie(resp, anonymousIdCookie);

    return new HTMLRewriter()
      .on(
        "head",
        new ElementHandler(
          host,
          this.writeKey,
          this.basePath,
          anonymousId,
          JSON.stringify(traits)
        )
      )
      .transform(resp);
  }

  async handle(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname;
    switch (this.determineURLType(path)) {
      case "ajs":
        return this.handleAJS(request);
      case "settings":
        return this.handleSettings(request);
      case "bundles":
        return this.handleBundles(request);
      case "tapi":
        return this.handleTAPI(request, env);
      case "source-function":
        return this.handleSourceFunction(request, env);
      case "personas":
        return this.handlePersonas(request, env);
      default:
        return this.handleRoot(request, env);
    }
  }
}
