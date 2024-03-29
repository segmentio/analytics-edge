import {
  handleTAPI,
  includeEdgeTraitsInContext,
  injectMetadata,
  injectWritekey,
} from "../tapi";
import { mockContext } from "./mocks";

const reqBodyFixture = {
  timestamp: "2022-10-06T06:08:42.057Z",
  integrations: { "Segment.io": true },
  userId: "🤿",
  anonymousId: "👻",
  type: "identify",
  traits: { isCool: "no" },
  context: {
    library: { name: "analytics.js", version: "next-1.43.0" },
  },
  messageId: "ajs-next-f142195b60efd67506bd5c4f7a4ffa99",
  writeKey: "Shall not be revealed",
} as const;

describe("origin handler", () => {
  beforeEach(() => {
    //@ts-ignore - getMiniflareFetchMock is global defined by miniflare
    const fetchMock = getMiniflareFetchMock();

    fetchMock.disableNetConnect();

    const origin = fetchMock.get("https://api.segment.io");
    origin
      .intercept({
        method: "POST",
        path: "/v1/p",
      })
      .reply(200, "Success!");
  });

  it("Proxies TAPI", async () => {
    const request = new Request("https://customer.com/seg/v1/p", {
      method: "POST",
      body: JSON.stringify({ type: "page" }),
    });
    const [req, resp, context] = await handleTAPI(
      request,
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
  });

  it("Enrich identify calls with Edge traits", async () => {
    const request = new Request("https://customer.com/seg/v1/i", {
      method: "POST",
      body: JSON.stringify(reqBodyFixture),
      cf: {
        city: "Vancouver",
        region: "Beautiful British Columbia",
        country: "CA",
        latitude: "49.2827",
        longitude: "-123.1207",
        postalCode: "V6B 6E3",
        timezone: "America/Vancouver",
      } as RequestInitCfProperties,
    });

    const [req, resp, context] = await includeEdgeTraitsInContext(
      request,
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    const body = await req.json();
    expect(body).toBeDefined();
    //@ts-ignore
    expect(body?.context).toMatchObject({
      edge: {
        city: "Vancouver",
        country: "CA",
        latitude: "49.2827",
        longitude: "-123.1207",
        postalCode: "V6B 6E3",
        region: "Beautiful British Columbia",
        timezone: "America/Vancouver",
      },
    });
  });

  it("Inject writekey to the headers", async () => {
    const request = new Request("https://customer.com/seg/v1/p", {
      method: "POST",
      body: JSON.stringify({ type: "page", writeKey: "REDACTED" }),
    });
    const [req] = await injectWritekey(
      request,
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(req.headers.get("Authorization")).toBe(
      "Basic VEhJU19JU19BX1dSSVRFX0tFWTo="
    ); // THIS_IS_A_WRITE_KEY base64 encoded

    const body = await req.json();
    expect(body).toEqual({ type: "page" });
  });

  it("Injects metadata into body", async () => {
    const request = new Request("https://customer.com/seg/v1/p", {
      method: "POST",
      body: JSON.stringify(reqBodyFixture),
    });
    const [req] = await injectMetadata(request, new Response(), mockContext);
    const body = (await req.json()) as any;
    expect(body._metadata.jsRuntime).toBe("cloudflare-worker");
    const [edgeVersion, ajsVersion] = body.context.library.version.split(":");
    expect(edgeVersion).toMatch(/edge-\d*/);
    expect(ajsVersion).toMatch(reqBodyFixture.context.library.version);
  });
});
