import { Segment } from "@segment/edge-sdk-cloudflare";
import type { Env as SDKEnv } from "@segment/edge-sdk-cloudflare";

type Env = SDKEnv & {
  SEGMENT_WRITE_KEY: string;
  PERSONAS_SPACE_ID: string;
  PERSONAS_TOKEN: string;
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const writeKey = env.SEGMENT_WRITE_KEY;
    const personasSpaceId = env.PERSONAS_SPACE_ID;
    const personasToken = env.PERSONAS_TOKEN;

    const segment = new Segment(
      writeKey,
      "seg",
      true,
      personasSpaceId,
      personasToken
    );

    return segment.handle(request, env);
  },
};
