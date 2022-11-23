import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import {
  handleTAPI,
  includeEdgeTraitsInContext,
  injectWritekey,
} from "../tapi";
import { mockContext } from "./mocks";

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
      undefined,
      mockContext
    );
    expect(resp?.status).toBe(200);
  });

  it("Enrich identify calls with Edge traits", async () => {
    const request = new Request("https://customer.com/seg/v1/i", {
      method: "POST",
      body: JSON.stringify({
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
      }),
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
      undefined,
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
    const [req, resp, context] = await injectWritekey(
      request,
      undefined,
      mockContext
    );
    expect(req.headers.get("Authorization")).toBe(
      "Basic VEhJU19JU19BX1dSSVRFX0tFWTo="
    ); // THIS_IS_A_WRITE_KEY base64 encoded

    const body = await req.json();
    expect(body).toEqual({ type: "page" });
  });
});
