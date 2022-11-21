import { Segment } from "@segment/edge-sdk-cloudflare";

export interface Env {
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
      {
        useProfilesAPI: false,
        ajsInjection: false,
        edgeVariations: false,
        clientSideTraits: false,
        proxyOrigin: false,
        serverSideCookies: true,
      }
    );

    const resp = await segment.handleEvent(request);

    if (resp) {
      return resp;
    } else {
      return new Response("no response");
    }
  },
};
