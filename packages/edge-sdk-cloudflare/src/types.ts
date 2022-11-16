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
  variations?: Array<{
    route: string;
    evaluationFunction: VariationEvaluationFunction;
  }>;
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
  edgeContext?: boolean;
  edgeVariations?: boolean;
  ajsInjection?: boolean;
  serverSideCookies?: boolean;
  redactWritekey?: boolean;
  clientSideTraits?: boolean;
  engageIncomingWebhook?: boolean;
  useProfilesAPI?: boolean;
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
