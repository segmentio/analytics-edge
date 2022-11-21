import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import {
  EdgeSDKFeatures,
  EdgeSDKSettings,
  Storage,
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
  configureApiHost,
  handleAJS,
  handleBundles,
  handleCORS,
  handleSettings,
  redactWritekey,
} from "./assetsProxy";
import { handleTAPI, includeEdgeTraitsInContext, injectWritekey } from "./tapi";
import {
  handleOrigin,
  handleOriginWithEarlyExit,
  handleWith404,
} from "./origin";
import { Logger, LogLevel } from "./logger";

const sdkDefaultSettings = {
  routePrefix: "seg",
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
  proxyOrigin: true,
};

export class Segment {
  private writeKey: string;
  private routePrefix: string;
  private personasSpaceId: string | undefined;
  private personasToken: string | undefined;
  private router: Router;
  private baseSegmentCDN: string;
  private _variations: Array<{
    route: string;
    evaluationFunction: VariationEvaluationFunction;
  }>;
  private _traitsFunc: (traits: any) => void;
  private logger: Logger;
  private features: EdgeSDKFeatures;
  private profilesStorage?: Storage;

  get settings(): EdgeSDKSettings {
    return {
      writeKey: this.writeKey,
      routePrefix: this.routePrefix,
      personasSpaceId: this.personasSpaceId,
      personasToken: this.personasToken,
      baseSegmentCDN: this.baseSegmentCDN,
      profilesStorage: this.profilesStorage,
    };
  }

  get variations() {
    return this._variations;
  }

  get traitsFunc(): (traits: any) => void {
    return this._traitsFunc;
  }

  constructor(settings: EdgeSDKSettings, features: Partial<EdgeSDKFeatures>) {
    const {
      writeKey,
      routePrefix,
      personasSpaceId,
      personasToken,
      baseSegmentCDN,
      logLevels,
      profilesStorage,
    } = {
      ...sdkDefaultSettings,
      ...settings,
    };
    this.writeKey = writeKey;
    this.routePrefix = routePrefix;
    this.personasSpaceId = personasSpaceId;
    this.personasToken = personasToken;
    this.baseSegmentCDN = baseSegmentCDN;
    this.profilesStorage = profilesStorage;
    this._variations = [];
    this._traitsFunc = (traits: any) => {};
    this.logger = new Logger(logLevels);
    this.router = new Router(this.routePrefix, {
      settings: this.settings,
      traitsFunc: this.traitsFunc,
      variations: this.variations,
      logger: this.logger,
    });
    this.features = { ...sdkDefaultFeatures, ...features };
  }

  async handleEvent(request: Request) {
    const router = this.router;
    const features = this.features;

    // bundles/destinations handlers
    router.register("bundles", handleBundles);
    router.register("destinations", handleBundles);

    // AJS handlers
    this.router
      .register("ajs")
      .handler(
        extractIdFromCookie,
        features.serverSideCookies || features.clientSideTraits
      )
      .handler(extractProfileFromEdge, features.clientSideTraits)
      .handler(
        extractProfileFromEdge,
        features.useProfilesAPI && features.clientSideTraits
      )
      .handler(handleAJS)
      .handler(enrichResponseWithIdCookies, features.serverSideCookies)
      .handler(handleClientSideTraits, features.clientSideTraits)
      .handler(
        appendAJSCustomConfiguration,
        features.serverSideCookies || features.clientSideTraits
      )
      .handler(redactWritekey, features.redactWritekey);

    // settings handlers
    router
      .register("settings")
      .handler(handleSettings)
      .handler(configureApiHost)
      .handler(redactWritekey, features.redactWritekey)
      .handler(handleCORS);

    // TAPI handlers
    router
      .register("tapi")
      .handler(injectWritekey, features.redactWritekey)
      .handler(extractIdFromCookie)
      .handler(extractIdFromPayload)
      .handler(includeEdgeTraitsInContext, features.edgeContext)
      .handler(handleTAPI)
      .handler(enrichResponseWithIdCookies);

    // root handler logic
    features.proxyOrigin
      ? router
          .register("root")
          .handler(handleOriginWithEarlyExit)
          .handler(
            extractIdFromCookie,
            features.serverSideCookies || features.edgeVariations
          )
          .handler(extractProfileFromEdge, features.edgeVariations)
          .handler(
            extractProfileFromSegment,
            features.edgeVariations && features.useProfilesAPI
          )
          .handler(handleVariations, features.edgeVariations)
          .handler(handleOrigin)
          .handler(enrichResponseWithIdCookies, features.serverSideCookies)
          .handler(enrichWithAJS, features.ajsInjection)
      : router.register("root", handleWith404);

    // engage incoming webhook handler
    if (features.engageIncomingWebhook) {
      router.register("personas", handlePersonasWebhook);
    }

    router.register("bypass", handleOrigin);
    const [_, resp, __] = await router.handle(request);

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
