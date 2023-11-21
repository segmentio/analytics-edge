import { parse, stringify } from "worktop/cookie";
import { Router } from "./router";
import {
  EdgeSDKFeatures,
  EdgeSDKSettings,
  ProfileAPIPayload,
  SegmentTrackingAPIEndpoint,
  Storage,
  TraitsFunction,
  UserProfile,
  VariationEvaluationFunction,
} from "./types";
import {
  enrichResponseWithIdCookies,
  extractIdFromCookie,
  extractIdFromPayload,
  getCookie,
  resetCookies,
} from "./cookies";
import { enrichWithAJS, enrichWithAJSNoWriteKey } from "./parser";
import {
  handleVariations,
  handleClientSideTraits,
  handlePersonasWebhook,
  extractProfileFromEdge,
  extractProfileFromSegment,
} from "./personas";
import {
  appendAJSCustomConfiguration,
  appendIdCallsToAJS,
  configureApiHost,
  handleAJS,
  handleBundles,
  handleCORS,
  handleSettings,
  redactWritekey,
  removeSourcemapReference,
} from "./assetsProxy";
import {
  handleTAPI,
  includeEdgeTraitsInContext,
  injectMetadata,
  injectWritekey,
} from "./tapi";
import {
  handleOrigin,
  handleOriginWithEarlyExit,
  handleWith404,
} from "./origin";
import { Logger, LogLevel } from "./logger";

const sdkDefaultSettings = {
  routePrefix: "seg",
  baseSegmentCDN: "https://cdn.segment.com",
  logLevels: ["error", "warn", "info"] as LogLevel[],
  trackingApiEndpoint: "https://api.segment.io/v1",
  snippetInitialPageView: true,
};

const sdkDefaultFeatures: EdgeSDKFeatures = {
  edgeContext: true,
  ajsInjection: true,
  serverSideCookies: true,
  edgeVariations: true,
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
  private engageWebhookUsername: string | undefined;
  private engageWebhookPassword: string | undefined;
  private router: Router;
  private baseSegmentCDN: string;
  private _variations: Array<{
    route: string;
    evaluationFunction: VariationEvaluationFunction;
  }>;
  private _traitsFunc: TraitsFunction;
  private logger: Logger;
  private features: EdgeSDKFeatures;
  private profilesStorage?: Storage;
  private trackingApiEndpoint: SegmentTrackingAPIEndpoint;
  private snippetInitialPageView: boolean;
  private fastlySettings: EdgeSDKSettings['fastly'];
  private experimental: EdgeSDKSettings['experimental'];

  get settings(): EdgeSDKSettings {
    return {
      writeKey: this.writeKey,
      routePrefix: this.routePrefix,
      personasSpaceId: this.personasSpaceId,
      personasToken: this.personasToken,
      engageWebhookPassword: this.engageWebhookPassword,
      engageWebhookUsername: this.engageWebhookUsername,
      baseSegmentCDN: this.baseSegmentCDN,
      profilesStorage: this.profilesStorage,
      trackingApiEndpoint: this.trackingApiEndpoint,
      snippetInitialPageView: this.snippetInitialPageView,
      fastly: this.fastlySettings,
      experimental: this.experimental
    };
  }

  get variations() {
    return this._variations;
  }

  get traitsFunc(): TraitsFunction {
    return this._traitsFunc;
  }

  /**
   * Constructor for Segment Edge SDK
   * @param {EdgeSDKSettings} settings - Settings for the SDK
   * @param {Partial<EdgeSDKFeatures>} features - Features to enable/disable
   */
  constructor(
    settings: EdgeSDKSettings,
    features: Partial<EdgeSDKFeatures> = {}
  ) {
    const {
      writeKey,
      routePrefix,
      personasSpaceId,
      personasToken,
      engageWebhookUsername,
      engageWebhookPassword,
      baseSegmentCDN,
      logLevels,
      profilesStorage,
      trackingApiEndpoint,
      snippetInitialPageView,
      fastly,
      experimental
    } = {
      ...sdkDefaultSettings,
      ...settings,
    };
    this.writeKey = writeKey;
    this.routePrefix = routePrefix;
    this.personasSpaceId = personasSpaceId;
    this.personasToken = personasToken;
    this.engageWebhookUsername = engageWebhookUsername;
    this.engageWebhookPassword = engageWebhookPassword;
    this.baseSegmentCDN = baseSegmentCDN;
    this.profilesStorage = profilesStorage;
    this.trackingApiEndpoint = trackingApiEndpoint;
    this.snippetInitialPageView = snippetInitialPageView;
    this.fastlySettings = fastly;
    this.experimental = experimental;
    this._variations = [];
    this._traitsFunc = (traits) => undefined;
    this.logger = new Logger(logLevels);
    this.router = new Router(this.routePrefix, {
      settings: this.settings,
      traitsFunc: (f) => this.traitsFunc(f),
      variations: this.variations,
      logger: this.logger,
      host: "",
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
        extractProfileFromSegment,
        features.useProfilesAPI && features.clientSideTraits
      )
      .handler(handleAJS)
      .handler(enrichResponseWithIdCookies, features.serverSideCookies)
      .handler(handleClientSideTraits, features.clientSideTraits)
      .handler(
        appendIdCallsToAJS,
        features.serverSideCookies || features.clientSideTraits
      )
      .handler(appendAJSCustomConfiguration)
      .handler(removeSourcemapReference)
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
      .handler(injectMetadata)
      .handler(extractIdFromCookie, features.serverSideCookies)
      .handler(extractIdFromPayload, features.serverSideCookies)
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
          .handler(
            enrichWithAJS,
            features.ajsInjection && !features.redactWritekey
          )
          .handler(
            enrichWithAJSNoWriteKey,
            features.ajsInjection && features.redactWritekey
          )
      : router.register("root", handleWith404);

    // engage incoming webhook handler
    if (features.engageIncomingWebhook) {
      router.register("personas", handlePersonasWebhook);
    }

    router.register("reset", resetCookies);

    router.register("bypass", handleOrigin);
    const [_, resp, __] = await router.handle(request);

    return resp;
  }

  /**
   * Register a variation on the `route`. If a visitor navigates to `route`, we run the evaluationFunction, and fetch the path returned from the function instead of the `route`. If the evaluationFunction returns `undefined`, we then fetch the `route` from the origin.
   * @param {string} route - Route to register the variation on
   * @param {VariationEvaluationFunction} evaluationFunction - Function that returns the variation path by evaluating the audience
   */
  async registerVariation(
    route: string,
    evaluationFunction: VariationEvaluationFunction
  ) {
    this.variations.push({
      route,
      evaluationFunction,
    });
  }

  /**
   * The SDK can expose a reduced set of user traits to the client. By using the `clientSideTraits` method, the Edge SDK transforms the `audiences` object to a reduced form that can be exposed to the client, and then sets the reduced audiences as a client-side trait in Analytics.js.
   * @param {TraitsFunction} traitsFunction - Function that returns a client-side traits object by transforming the full audience object
   */
  async clientSideTraits(func: TraitsFunction) {
    this._traitsFunc = func;
  }

  /**
   * Get the profile, including traits, of the user associated with the request.
   * If the user can not be identified, or the profile can't be retrieved, this returns `undefined`.
   * @param {Request} request - The request to identify the user from.
   * @returns 
   */
  async getProfile(request: Request): Promise<UserProfile | undefined> {
    const userId = getCookie(request, 'ajs_user_id')
    if (!userId) return

    const { profilesStorage } = this.settings
    const profileData = await profilesStorage?.get(`uid:${userId}`)
    if (profileData) return JSON.parse(profileData)
    return getProfileFromSegment(this, userId)

  }
}

async function getProfileFromSegment(segment: Segment, userId: string) {
	const { personasSpaceId, personasToken, profilesStorage } = segment.settings
	const data = await fetch(
		`https://profiles.segment.com/v1/spaces/${personasSpaceId}/collections/users/profiles/user_id:${userId}/traits?limit=200`,
		{
			method: 'GET',
			headers: {
				'Authorization': `Basic ${btoa(`${personasToken}:`)}`
			}
		}
	)

	if (data.status === 200) {
		const profilesResponse = await data.json() as ProfileAPIPayload
		const profileData = profilesResponse?.traits
		await profilesStorage?.put(
			`uid:${userId}`,
			JSON.stringify(profileData),
			{ expirationTtl: 120 /* 2 minutes */ }
		)
		return profileData
	}
}