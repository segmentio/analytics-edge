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
  instance: Segment;
  env: Env;
  [key: string]: any;
}

export interface HandlerFunction {
  (
    request: Request,
    response: Response | undefined,
    context: RouterContext
  ): Promise<[Request, Response | undefined, RouterContext]>;
}
