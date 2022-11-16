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
  handleVariations,
  handleClientSideTraits,
  handlePersonasWebhook,
  extractProfileFromEdge,
  extractProfileFromSegment,
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

const sdkDefaultFeatures: EdgeSDKFeatures = {
  edgeContext: true,
  edgeVariations: true,
  ajsInjection: true,
  serverSideCookies: true,
  redactWritekey: true,
  clientSideTraits: true,
  engageIncomingWebhook: true,
  useProfilesAPI: true,
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

    // bundles/destinations handlers
    router.register("bundles", handleBundles);
    router.register("destinations", handleBundles);

    // AJS handlers
    (this.features.serverSideCookies || this.features.clientSideTraits) &&
      router.register("ajs", extractIdFromCookie);
    this.features.clientSideTraits &&
      router.register("ajs", extractProfileFromEdge);
    this.features.clientSideTraits &&
      this.features.useProfilesAPI &&
      router.register("ajs", extractProfileFromSegment);
    router.register("ajs", handleAJS);
    this.features.serverSideCookies &&
      router.register("ajs", enrichResponseWithIdCookies);
    this.features.clientSideTraits &&
      router.register("ajs", handleClientSideTraits);
    (this.features.serverSideCookies || this.features.clientSideTraits) &&
      router.register("ajs", appendAJSCustomConfiguration);
    this.features.redactWritekey && router.register("ajs", redactWritekey);

    // settings handlers
    router.register("settings", handleSettings);
    this.features.redactWritekey && router.register("settings", redactWritekey);

    // TAPI handlers
    this.features.redactWritekey && router.register("tapi", injectWritekey);
    router.register("tapi", extractIdFromCookie, extractIdFromPayload);
    this.features.edgeContext &&
      router.register("tapi", includeEdgeTraitsInContext);
    router.register("tapi", handleTAPI, enrichResponseWithIdCookies);

    // root handler logic
    router.register("root", handleOriginWithEarlyExit);
    (this.features.serverSideCookies || this.features.edgeVariations) &&
      router.register("root", extractIdFromCookie);

    if (this.features.edgeVariations) {
      this.features.useProfilesAPI
        ? router.register(
            "root",
            extractProfileFromEdge,
            extractProfileFromSegment,
            handleVariations
          )
        : router.register("root", extractProfileFromEdge, handleVariations);
    }

    router.register("root", handleOrigin);

    this.features.serverSideCookies &&
      router.register("root", enrichResponseWithIdCookies);

    this.features.ajsInjection && router.register("root", enrichWithAJS);

    // engage incoming webhook handler
    if (this.features.engageIncomingWebhook) {
      router.register("personas", handlePersonasWebhook);
    }

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
