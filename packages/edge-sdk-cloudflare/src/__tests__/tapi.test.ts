import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import {
  handleTAPI,
  includeEdgeTraitsInContext,
  injectWritekey,
} from "../tapi";
import { Env } from "../types";
import { mockContext } from "./mocks";

describe("origin handler", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/html",
        }),
      });
    });
  });

  afterEach(() => {
    //@ts-ignore
    globalThis.fetch.mockClear();
  });

  it("Proxies TAPI", async () => {
    const request = new Request("https://customer.com/seg/v1/p", {
      method: "POST",
      body: JSON.stringify({ type: "page" }),
    });
    const [req, resp, context] = await handleTAPI(request, undefined, {
      ...mockContext,
    });
    expect(globalThis.fetch).toBeCalledWith(
      "https://api.segment.io/v1/p",
      request
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
    });

    request.cf = {
      city: "Vancouver",
      region: "Beautiful British Columbia",
      country: "Canada",
      latitude: "49.2827",
      longitude: "-123.1207",
      postalCode: "V6B 6E3",
      timezone: "America/Vancouver",
      asn: 13335,
      asOrganization: "Cloudflare, Inc.",
      colo: "YYZ",
      requestPriority: "2",
      tlsCipher: "ECDHE-ECDSA-AES128-GCM-SHA256",
      tlsVersion: "TLSv1.3",
      httpProtocol: "HTTP/2",
      clientTcpRtt: 0,
    };
    const [req, resp, context] = await includeEdgeTraitsInContext(
      request,
      undefined,
      {
        ...mockContext,
      }
    );
    const body = await req.json();
    expect(body).toBeDefined();
    //@ts-ignore
    expect(body?.context).toMatchObject({
      edge: {
        city: "Vancouver",
        country: "Canada",
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
    const [req, resp, context] = await injectWritekey(request, undefined, {
      ...mockContext,
    });
    expect(req.headers.get("Authorization")).toBe(
      "Basic VEhJU19JU19BX1dSSVRFX0tFWTo="
    ); // THIS_IS_A_WRITE_KEY base64 encoded

    const body = await req.json();
    expect(body).toEqual({ type: "page" });
  });
});
