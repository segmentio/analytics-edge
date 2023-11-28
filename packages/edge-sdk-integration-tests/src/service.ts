import { EdgeSDKSettings } from "@segment/edge-sdk";

export interface Service {
  fetch(request: RequestInfo, init?: RequestInit): Promise<Response>;
  stop(): Promise<void>;

  edgeSdkSettings: Partial<EdgeSDKSettings>;
}