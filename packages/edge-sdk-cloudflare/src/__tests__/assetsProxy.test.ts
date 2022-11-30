import {
  appendAJSCustomConfiguration,
  appendIdCallsToAJS,
  handleAJS,
  handleBundles,
  handleSettings,
  redactWritekey,
} from "../assetsProxy";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext, mockSegmentCDN } from "./mocks";

describe("asset proxy", () => {
  beforeAll(() => {
    mockSegmentCDN();
  });

  it("Proxy AJS regardless of the passed in url", async () => {
    const [req, resp, context] = await handleAJS(
      new Request("https://doest-not-matter.com/"),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toBe("Analytics JS Code!");
  });

  it("Proxy settigs regardless of the passed in url", async () => {
    const [req, resp, context] = await handleSettings(
      new Request("https://doest-not-matter.com/"),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Segment.io");
    expect(data).toContain("integrations");
  });

  it("Proxy AJS bundles", async () => {
    const [req, resp, context] = await handleBundles(
      new Request(
        "https://sushi-shop.com/seg/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
      ),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toBe("Schema filter 👨🏻‍💻");
  });

  it("Proxy action destination bundles", async () => {
    const [req, resp, context] = await handleBundles(
      new Request(
        "https://sushi-shop.com/seg/next-integrations/actions/edge_sdk/ed984d68b220640a83ac.js"
      ),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toBe("Edge SDK destination (Actions) 💥");
  });

  it("Proxy legacy destination bundles", async () => {
    const [req, resp, context] = await handleBundles(
      new Request(
        "https://sushi-shop.com/seg/next-integrations/integrations/edge/2.2.4/edge.dynamic.js.gz"
      ),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toBe("Edge SDK destination (Legacy) 👴");
  });

  it("Enrich with CDN handler info", async () => {
    const [req, resp, context] = await appendAJSCustomConfiguration(
      new Request("https://doest-not-matter.com", {
        headers: { host: "sushi-shop.com" },
      }),
      new Response("The amazing AJS minified code!"),
      { ...mockContext, host: "sushi-shop.com" }
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe(`
    analytics._cdn = "https://sushi-shop.com/seg";
    The amazing AJS minified code!`);
  });

  it("Enrich with anonymousId call", async () => {
    const [req, resp, context] = await appendIdCallsToAJS(
      new Request("https://doest-not-matter.com", {
        headers: { host: "sushi-shop.com" },
      }),
      new Response("The amazing AJS minified code!"),
      {
        ...mockContext,
        anonymousId: "👻",
      }
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe(`
    analytics.setAnonymousId("👻");
    analytics.on('reset', function() { fetch('https://sushi-shop.com/seg/reset', {credentials:"include"}) });
    The amazing AJS minified code!`);
  });

  it("Enrich with user id", async () => {
    const [req, resp, context] = await appendIdCallsToAJS(
      new Request("https://doest-not-matter.com", {
        headers: { host: "sushi-shop.com" },
      }),
      new Response("The amazing AJS minified code!"),
      {
        ...mockContext,
        userId: "👋",
      }
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe(`
    analytics.identify("👋");
    analytics.on('reset', function() { fetch('https://sushi-shop.com/seg/reset', {credentials:"include"}) });
    The amazing AJS minified code!`);
  });

  it("Enrich with client-side traits", async () => {
    const [req, resp, context] = await appendIdCallsToAJS(
      new Request("https://doest-not-matter.com", {
        headers: { host: "sushi-shop.com" },
      }),
      new Response("The amazing AJS minified code!"),
      {
        ...mockContext,
        userId: "👋",
        clientSideTraits: {
          locale: "en",
        },
      }
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe(`
    analytics.identify("👋", {"locale":"en"});
    analytics.on('reset', function() { fetch('https://sushi-shop.com/seg/reset', {credentials:"include"}) });
    The amazing AJS minified code!`);
  });

  it("Redacts the writekey in response", async () => {
    const [req, resp, context] = await redactWritekey(
      new Request("https://doest-not-matter.com"),
      new Response("analytics.load('writekeys are not secret')"),
      {
        ...mockContext,
        settings: {
          ...mockContext.settings,
          writeKey: "writekeys are not secret",
        },
      }
    );
    expect(await resp?.text()).toBe(`analytics.load('REDACTED')`);
  });
});
