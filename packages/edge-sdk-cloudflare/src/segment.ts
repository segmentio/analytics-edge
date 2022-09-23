import ElementHandler from "./parser";
import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import { Env } from "./types";
import { enrichResponseWithCookie, getCookie } from "./cookies";
import enrichWithAJS from "./parser";
import {
  extractProfile,
  handleABTests,
  handleClientSideTraits,
  handlePersonasWebhook,
  handleProfile,
} from "./personas";
import { handleAJS, handleBundles, handleSettings } from "./assetsProxy";
import { enrichEdgeTraits, handleEdgeFunctions, handleTAPI } from "./tapi";
import { handleSourceFunction } from "./sourceFunction";
import { handleOrigin } from "./origin";

export class Segment {
  writeKey: string;
  basePath: string;
  collectEdgeData: boolean;
  personasSpaceId: string | undefined;
  personasToken: string | undefined;
  router: Router;
  baseSegment: string;
  experiments: any[];
  traitsFunc: (traits: any) => void;

  constructor(
    writeKey: string,
    basePath: string = "segment",
    collectEdgeData = true,
    env: Env,
    personasSpaceId?: string,
    personasToken?: string
  ) {
    this.writeKey = writeKey;
    this.basePath = basePath;
    this.collectEdgeData = collectEdgeData;
    this.personasSpaceId = personasSpaceId;
    this.personasToken = personasToken;
    this.router = new Router(this.basePath, env, this);
    this.baseSegment = "https://cdn.segment.com";
    this.experiments = [];
    this.traitsFunc = (traits: any) => {};
  }

  async handleEvent(request: Request, env: Env) {
    const host = request.headers.get("host") || ""; // can this be null?

    this.router.register(
      "ajs",
      handleAJS,
      enrichResponseWithCookie("ajs_anonymous_id", host || undefined)
    );
    this.router.register("settings", handleSettings);
    this.router.register("bundles", handleBundles);
    this.router.register("destinations", handleBundles);
    this.router.register("tapi", enrichEdgeTraits, handleTAPI);
    this.router.register(
      "root",
      handleProfile,
      handleABTests,
      handleOrigin,
      enrichResponseWithCookie("ajs_anonymous_id", host || undefined),
      handleClientSideTraits,
      enrichWithAJS(host, this.writeKey, this.basePath)
    );
    this.router.register("bypass", handleOrigin);
    const [_, resp, __] = await this.router.handle(request);

    return resp;
  }

  async registerABTesting(
    originalRoute: string,
    positiveRoute: string,
    negativeRoute: string,
    evaluationFunction: (traits: any) => boolean | undefined
  ) {
    this.experiments.push({
      originalRoute,
      positiveRoute,
      negativeRoute,
      evaluationFunction,
    });
  }

  async clientSideTraits(func: (traits: any) => void) {
    this.traitsFunc = func;
  }
}
