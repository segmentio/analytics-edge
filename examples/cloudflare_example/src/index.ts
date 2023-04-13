import { Segment } from "@segment/edge-sdk";

type Env = {
  SEGMENT_WRITE_KEY: string;
  PERSONAS_SPACE_ID: string;
  PERSONAS_TOKEN: string;
  Profiles: KVNamespace;
  OPENAI_ORGANIZATION_ID: string;
  OPENAI_API_KEY: string;
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const segment = new Segment({
      writeKey: env.SEGMENT_WRITE_KEY,
      personasSpaceId: env.PERSONAS_SPACE_ID,
      routePrefix: "seg",
      personasToken: env.PERSONAS_TOKEN,
      profilesStorage: env.Profiles,
      logLevels: ["error", "warn", "info", "debug"],
      openai: {
        ORGANIZATION_ID: env.OPENAI_ORGANIZATION_ID,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
      },
    });

    const resp = await segment.handleEvent(request);
    //@ts-ignore
    return resp;
  },
};
