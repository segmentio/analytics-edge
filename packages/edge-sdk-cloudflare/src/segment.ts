import ElementHandler from "./parser";
import { nanoid } from "nanoid";
import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import { EdgeSDKFeatures, EdgeSDKSettings, Env } from "./types";
import {
  enrichResponseWithIdCookies,
  extractIdFromCookie,
  extractIdFromPayload,
  getCookie,
} from "./cookies";
import enrichWithAJS from "./parser";
import {
  extractProfile,
  handleExperiments,
  handleClientSideTraits,
  handlePersonasWebhook,
  handleProfile,
} from "./personas";
import {
  enrichAssetWithAJSCalls,
  handleAJS,
  handleBundles,
  handleSettings,
} from "./assetsProxy";
import { enrichEdgeTraits, handleEdgeFunctions, handleTAPI } from "./tapi";
import { handleSourceFunction } from "./sourceFunction";
import { handleOrigin, handleOriginWithEarlyExit } from "./origin";
import { Logger, LogLevel } from "./logger";

const sdkDefaultSettings = {
  routePrefix: "seg",
  collectEdgeData: true,
  baseSegmentCDN: "https://cdn.segment.com",
  logLevels: ["error", "warn", "info", "debug"] as LogLevel[],
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
  private _experiments: any[];
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

  get experiments(): any[] {
    return this._experiments;
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
    this._experiments = [];
    this._env = env;
    this._traitsFunc = (traits: any) => {};
    this.logger = new Logger(logLevels);
    this.router = new Router(this.routePrefix, {
      settings: this.settings,
      env,
      traitsFunc: this.traitsFunc,
      experiments: this.experiments,
      logger: this.logger,
    });
    this.features = features;
  }

  private setupRoutes() {
    return null;
  }

  async handleEvent(request: Request, env: Env) {
    const host = request.headers.get("host") || ""; // can this be null?

    this.router.register(
      "ajs",
      extractIdFromCookie,
      handleProfile,
      handleAJS,
      enrichResponseWithIdCookies,
      handleClientSideTraits,
      enrichAssetWithAJSCalls
    );
    this.router.register("settings", handleSettings);
    this.router.register("bundles", handleBundles);
    this.router.register("destinations", handleBundles);
    this.router.register(
      "tapi",
      extractIdFromCookie,
      extractIdFromPayload,
      enrichEdgeTraits,
      handleTAPI,
      enrichResponseWithIdCookies
    );
    this.router.register(
      "root",
      handleOriginWithEarlyExit,
      extractIdFromCookie,
      handleProfile,
      handleExperiments,
      handleOrigin,
      enrichResponseWithIdCookies,
      handleClientSideTraits,
      enrichWithAJS(host, this.writeKey, this.routePrefix)
    );
    this.router.register("bypass", handleOrigin);
    const [_, resp, __] = await this.router.handle(request);

    return resp;
  }

  async registerExperiment(
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
    this._traitsFunc = func;
  }
}
