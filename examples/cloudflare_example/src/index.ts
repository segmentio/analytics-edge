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
    const segment = new Segment(
      env.SEGMENT_WRITE_KEY,
      "seg",
      true,
      env,
      env.PERSONAS_SPACE_ID,
      env.PERSONAS_TOKEN
    );

    segment.registerExperiment("/", "/van", "/sf", (audiences) => {
      if (!audiences) {
        return;
      }
      return !!audiences.vancouver_crew;
    });

    const resp = await segment.handleEvent(request, env);

    //@ts-ignore
    return resp;
  },
};
