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

    segment.registerABTesting("/", "/van", "/sf", (traits) => {
      if (!traits) {
        return;
      }
      return !!(traits.age > 10);
    });

    segment.clientSideTraits((traits = {}) => {
      return {
        ageRange: traits?.age > 10 ? "adult" : "child",
      };
    });

    const resp = await segment.handleEvent(request, env);
    //@ts-ignore
    return resp;
  },
};

/*
    const segment = new Segment(
      env.SEGMENT_WRITE_KEY,
      "seg",
      true,
      env,
      env.PERSONAS_SPACE_ID,
      env.PERSONAS_TOKEN
    );

    segment.registerABTesting("/", "/van", "/sf", (traits) => {
      if (!traits) {
        return;
      }
      return !!(traits.age > 10);
    });


    const resp = await segment.handleEvent(request, env);

*/

/*
    segment.clientSideTraits((traits = {}) => {
      return {
        ageRange: traits?.age > 10 ? "adult" : "child",
      };
    });

*/
