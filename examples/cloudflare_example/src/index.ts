import { Segment } from "@segment/edge-sdk";

type Env = {
  SEGMENT_WRITE_KEY: string;
  PERSONAS_SPACE_ID: string;
  PERSONAS_TOKEN: string;
  Profiles: KVNamespace;
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const segment = new Segment({
      writeKey: env.SEGMENT_WRITE_KEY,
      personasSpaceId: env.PERSONAS_SPACE_ID,
      routePrefix: "wut",
      personasToken: env.PERSONAS_TOKEN,
      profilesStorage: env.Profiles,
      logLevels: ["error", "warn", "info", "debug"],
    });

    segment.registerVariation("/", (audiences) => {
      if (!audiences) {
        return;
      }
      return audiences.vancouver_crew ? "/van" : "/sf";
    });

    segment.clientSideTraits((traits) => {
      return {
        test_trait: true,
        another_trait: "hello",
      };
    });

    const resp = await segment.handleEvent(request);

    //@ts-ignore
    return resp;
  },
};
