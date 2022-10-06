import { Logger } from "./logger";
import { Segment } from "./segment";

export interface Env {
  Profiles: KVNamespace;
  EdgeFunctions: KVNamespace;
  dispatcher: { [key: string]: any };
}

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
  env: Env;
  logger: Logger;
  earlyExit?: boolean;
  anonymousId?: string;
  userId?: string;
  traitsFunc?: (traits: any) => void; // fix type
  experiments?: any[]; // fix type
  [key: string]: any;
}

export interface HandlerFunction {
  (
    request: Request,
    response: Response | undefined,
    context: RouterContext
  ): Promise<[Request, Response | undefined, RouterContext]>;
}

export interface EdgeSDKSettings {
  personasSpaceId?: string;
  personasToken?: string;
  routePrefix: string;
  writeKey: string;
  collectEdgeData?: boolean;
  baseSegmentCDN?: string;
}

export interface EdgeSDKFeatures {
  edgeTraitEnrichment?: boolean;
  edgeExperiments?: boolean;
  ajsInjection?: boolean;
  serverSideCookies?: boolean;
}
