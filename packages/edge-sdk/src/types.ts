import { Logger, LogLevel } from "./logger";
import { Segment } from "./segment";
import { Options } from "@segment/snippet";

export interface Storage {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
}

export interface UserIdentity {
  userId: string | undefined;
  anonymousId: string | undefined;
}

export interface RouterContext {
  settings: EdgeSDKSettings;
  logger: Logger;
  host: string;
  earlyExit?: boolean;
  anonymousId?: string;
  userId?: string;
  traitsFunc?: (traits: Record<string, any>) => Record<string, any> | undefined;
  variations?: Array<{
    route: string;
    evaluationFunction: VariationEvaluationFunction;
  }>;
  clientSideTraits?: Record<string, any>;
  [key: string]: any;
}

export interface HandlerFunction {
  (request: Request, response: Response, context: RouterContext): Promise<
    [Request, Response, RouterContext]
  >;
}

/**
 * Settings to initialize the SDK with,
 */
export interface EdgeSDKSettings {
  /**
   * Segment Personas Space ID
   * Only required if you want to use Personas Profile API feature
   * */
  personasSpaceId?: string;
  /**
   * Segment Personas Token
   * Only required if you want to use Personas Profile API feature
   * */
  personasToken?: string;
  /**
   * Edge SDK will expose few routes to serve assets, collect data, etc.
   * This prefix will be used to prefix all the routes exposed by the SDK.
   * @example "edge-sdk" will result in routes like "www.example.com/edge-sdk/ajs", "www.example.com/edge-sdk/event/t" etc.
   * @required
   * */
  routePrefix: string;
  /**
   * The Segment write key to use for sending events to Segment
   * @required
   * */
  writeKey: string;
  /**
   * This is the base Segment CDN URL that will be proxied by the SDK.
   * @default "https://cdn.segment.com"
   * */
  baseSegmentCDN?: string;
  /**
   * Profiles storage, should be a KV Store
   *
   * */
  profilesStorage?: Storage;
  /**
   * Log levels for the SDK
   * @default ["error", "warn", "info"]
   * @example ["error", "warn", "info", "debug"]
   *
   * */
  logLevels?: LogLevel[];
  /**
   * The Segment tracking API endpoint that will be used to send events to Segment
   * @default "https://api.segment.io/v1"
   * @example "https://events.eu1.segmentapis.com/v1"
   *
   * */
  trackingApiEndpoint?: SegmentTrackingAPIEndpoint;
  /**
   * Username for engage incoming webhook. Should be used with password.
   * @example "https://events.eu1.segmentapis.com/v1"
   *
   * */
  engageWebhookUsername?: string;
  /**
   * Password for engage incoming webhook. Should be used with the username.
   * @example "https://events.eu1.segmentapis.com/v1"
   *
   * */
  engageWebhookPassword?: string;
  /**
   * Determines whether the injected snippet contains an initial page call or not.
   * @default true
   * @example false
   *
   * */
  snippetInitialPageView?: boolean;

  /**
   * OpenAI API Key and Organization ID
   * @example { OPENAI_API_KEY: "sk-xxxx", ORGANIZATION_ID: "org-xxxx"}
   *
   * */
  openai?: {
    OPENAI_API_KEY: string;
    ORGANIZATION_ID: string;
  };
}

/**
 * Choose which features you want to enable/disable
 */
export interface EdgeSDKFeatures {
  /**
   * SDK includes the Edge information on the context object sent to Segment
   * The Edge information includes the location, region, timezone, etc.
   * @default true
   */
  edgeContext: boolean;
  /**
   * SDK will provide a way to run A/B tests on the Edge
   * The Cloudflare Worker should be setup as a full proxy using Routes in order to use this feature
   * @default true
   */
  edgeVariations: boolean;
  /**
   * SDK will automatically inject the Segment snippet on the page
   * The Cloudflare Worker should be setup as a full proxy using Routes in order to use this feature
   * @default true
   */
  ajsInjection: boolean;
  /**
   * Determines if the SDK should proxy the origin
   * The Cloudflare Worker should be setup as a full proxy using Routes in order to use this feature
   * @default true
   */
  proxyOrigin: boolean;
  /**
   * SDK will set HTTPOnly cookies on the browser to track the userId and anonymousId
   * @default true
   */
  serverSideCookies: boolean;
  /**
   * SDK will not expose the writekey in the browser and
   * only includes the writekey on the Edge before sending data to Segment
   * @default true
   */
  redactWritekey: boolean;
  /**
   * SDK will provide the option to send certain traits to the browser
   * @default true
   */
  clientSideTraits: boolean;
  /**
   * SDK will expose a route to receive Engage Webhook events and update the user profile
   * @example: "www.example.com/<router_prefix>/personas"
   * @default true
   */
  engageIncomingWebhook: boolean;
  /**
   * SDK will use the Segment Personas Profile API to fetch the user profile
   * only used if profile is not found in the KV store
   * @default true
   */
  useProfilesAPI: boolean;
}

export type VariationEvaluationFunction = (
  audiences: Record<string, boolean>
) => string | undefined;

export type UserProfile = Record<string, any>;
export type UserProfileIndex = `user_id:${string}`;

export interface PersonasWebhookPayload {
  type: "identify" | "track";
  userId: string;
  traits: Record<string, any>;
  context: {
    personas: {
      computation_class: "audience" | "computed_trait";
      computation_id: string;
      computation_key: string;
      namespace: string;
      space_id: string;
    };
  };
}

export interface ProfileAPIPayload {
  traits: Record<string, any>;
}

export type TraitsFunction = (
  traits: Record<string, any>
) => Record<string, any> | undefined;

export type SegmentTrackingAPIEndpoint =
  /* Main us-west2 Segment Tracking API */
  | "https://api.segment.io/v1"
  /* EU Segment Tracking API */
  | "https://events.eu1.segmentapis.com"
  /* Custom Tracking API */
  | Omit<
      string,
      "https://api.segment.io/v1" | "https://events.eu1.segmentapis.com"
    >;
