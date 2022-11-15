import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import {
  EdgeSDKFeatures,
  EdgeSDKSettings,
  Env,
  VariationEvaluationFunction,
} from "./types";
import {
  enrichResponseWithIdCookies,
  extractIdFromCookie,
  extractIdFromPayload,
  getCookie,
} from "./cookies";
import { enrichWithAJS } from "./parser";
import {
  extractProfile,
  handleVariations,
  handleClientSideTraits,
  handlePersonasWebhook,
  handleProfile,
} from "./personas";
import {
  appendAJSCustomConfiguration,
  handleAJS,
  handleBundles,
  handleSettings,
  redactWritekey,
} from "./assetsProxy";
import { handleTAPI, includeEdgeTraitsInContext, injectWritekey } from "./tapi";
import { handleOrigin, handleOriginWithEarlyExit } from "./origin";
import { Logger, LogLevel } from "./logger";

const sdkDefaultSettings = {
  routePrefix: "seg",
  collectEdgeData: true,
  baseSegmentCDN: "https://cdn.segment.com",
  logLevels: ["error", "warn", "info", "debug"] as LogLevel[],
};

const sdkDefaultFeatures = {
  edgeContext: true,
  edgeVariations: true,
  ajsInjection: true,
  serverSideCookies: true,
  redactWritekey: true,
};

export class Segment {
  private writeKey: string;
  private routePrefix: string;
  private collectEdgeData: boolean;
  private personasSpaceId: string | undefined;
  private personasToken: string | undefined;
  private _env: Env;
  private router: Router;
  private baseSegmentCDN: string;
  private _variations: Array<{
    route: string;
    evaluationFunction: VariationEvaluationFunction;
  }>;
  private _traitsFunc: (traits: any) => void;
  private logger: Logger;
  private features: EdgeSDKFeatures;

  get settings(): EdgeSDKSettings {
    return {
      writeKey: this.writeKey,
      routePrefix: this.routePrefix,
      collectEdgeData: this.collectEdgeData,
      personasSpaceId: this.personasSpaceId,
      personasToken: this.personasToken,
      baseSegmentCDN: this.baseSegmentCDN,
    };
  }

  get env(): Env {
    return this.env;
  }

  get variations() {
    return this._variations;
  }

  get traitsFunc(): (traits: any) => void {
    return this._traitsFunc;
  }

  constructor(settings: EdgeSDKSettings, env: Env, features: EdgeSDKFeatures) {
    const {
      writeKey,
      routePrefix,
      collectEdgeData,
      personasSpaceId,
      personasToken,
      baseSegmentCDN,
      logLevels,
    } = {
      ...sdkDefaultSettings,
      ...settings,
    };
    this.writeKey = writeKey;
    this.routePrefix = routePrefix;
    this.collectEdgeData = collectEdgeData;
    this.personasSpaceId = personasSpaceId;
    this.personasToken = personasToken;
    this.baseSegmentCDN = baseSegmentCDN;
    this._variations = [];
    this._env = env;
    this._traitsFunc = (traits: any) => {};
    this.logger = new Logger(logLevels);
    this.router = new Router(this.routePrefix, {
      settings: this.settings,
      env,
      traitsFunc: this.traitsFunc,
      variations: this.variations,
      logger: this.logger,
    });
    this.features = { ...sdkDefaultFeatures, ...features };
  }

  private setupRoutes() {
    return null;
  }

  async handleEvent(request: Request, env: Env) {
    const host = request.headers.get("host") || ""; // can this be null?
    const router = this.router;

    router.register("bundles", handleBundles);
    router.register("destinations", handleBundles);

    router.register(
      "ajs",
      extractIdFromCookie,
      handleProfile,
      handleAJS,
      enrichResponseWithIdCookies,
      handleClientSideTraits,
      appendAJSCustomConfiguration
    );

    router.register("settings", handleSettings);

    if (this.features.redactWritekey) {
      router.register("ajs", redactWritekey);
      router.register("settings", redactWritekey);
      router.register("tapi", injectWritekey);
    }

    router.register("tapi", extractIdFromCookie, extractIdFromPayload);
    this.features.edgeContext &&
      router.register("tapi", includeEdgeTraitsInContext);
    router.register("tapi", handleTAPI, enrichResponseWithIdCookies);

    // root handler logic
    router.register("root", handleOriginWithEarlyExit);
    (this.features.serverSideCookies || this.features.edgeVariations) &&
      router.register("root", extractIdFromCookie);

    this.features.edgeVariations &&
      router.register("root", handleProfile, handleVariations);

    router.register("root", handleOrigin);

    this.features.serverSideCookies &&
      router.register("root", enrichResponseWithIdCookies);

    this.features.ajsInjection && router.register("root", enrichWithAJS);

    router.register("bypass", handleOrigin);
    const [_, resp, __] = await this.router.handle(request);

    return resp;
  }

  async registerVariation(
    route: string,
    evaluationFunction: VariationEvaluationFunction
  ) {
    this.variations.push({
      route,
      evaluationFunction,
    });
  }

  async clientSideTraits(func: (traits: any) => void) {
    this._traitsFunc = func;
  }
}
