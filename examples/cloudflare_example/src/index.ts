import { Segment } from "@segment/edge-sdk-cloudflare";
import type { Env } from "@segment/edge-sdk-cloudflare";

declare global {
  const SEGMENT_WRITE_KEY: string;
  const PERSONAS_SPACE_ID: string;
  const PERSONAS_TOKEN: string;
}

const writeKey = SEGMENT_WRITE_KEY;
const personasSpaceId = PERSONAS_SPACE_ID;
const personasToken = PERSONAS_TOKEN;

const segment = new Segment(
  writeKey,
  "seg",
  true,
  personasSpaceId,
  personasToken
);
// export default segment.init();

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return segment.handle(request, env);
  },
};
