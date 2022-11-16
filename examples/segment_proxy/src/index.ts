import { Segment } from "@segment/edge-sdk-cloudflare";
import type { Env as SDKEnv } from "@segment/edge-sdk-cloudflare";

export interface Env extends SDKEnv {
  SEGMENT_WRITE_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const segment = new Segment(
      {
        writeKey: env.SEGMENT_WRITE_KEY,
        routePrefix: "magic",
      },
      env,
      {
        useProfilesAPI: false,
        ajsInjection: false,
        edgeVariations: false,
        clientSideTraits: false,
        proxyOrigin: false,
      }
    );

    const resp = await segment.handleEvent(request, env);

    if (resp) {
      return resp;
    } else {
      return new Response("no response");
    }
  },
};
