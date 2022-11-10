import {
  enrichAssetWithAJSCalls,
  handleAJS,
  handleBundles,
  handleSettings,
} from "../assetsProxy";
import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";
import { mockContext } from "./mocks";

describe("asset proxy", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
      });
    });
  });

  afterEach(() => {
    //@ts-ignore
    globalThis.fetch.mockClear();
  });

  it("Proxy AJS regardless of the passed in url", async () => {
    const [req, resp, context] = await handleAJS(
      new Request("https://doest-not-matter.com/"),
      undefined,
      {
        ...mockContext,
        settings: {
          ...mockContext.settings,
          writeKey: "abc",
        },
      }
    );
    expect(globalThis.fetch).toBeCalledWith(
      "https://cdn.segment.com/analytics.js/v1/abc/analytics.min.js"
    );
    expect(resp?.status).toBe(200);
  });

  it("Proxy settigs regardless of the passed in url", async () => {
    const [req, resp, context] = await handleSettings(
      new Request("https://doest-not-matter.com/"),
      undefined,
      {
        ...mockContext,
        params: {
          writeKey: "abc",
        },
      }
    );
    expect(globalThis.fetch).toBeCalledWith(
      "https://cdn.segment.com/v1/projects/abc/settings"
    );
    expect(resp?.status).toBe(200);
  });

  it("Proxy bundles", async () => {
    const [req, resp, context] = await handleBundles(
      new Request(
        "https://sushi-shop.com/seg/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
      ),
      undefined,
      {
        ...mockContext,
        params: {
          bundleName: "abc",
        },
      }
    );
    expect(globalThis.fetch).toBeCalledWith(
      "https://cdn.segment.com/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
    );
    expect(resp?.status).toBe(200);
  });

  it("Enrich with identity calls", async () => {
    const [req, resp, context] = await enrichAssetWithAJSCalls(
      new Request("https://doest-not-matter.com"),
      new Response("💾"),
      {
        ...mockContext,
        anonymousId: "👻",
        userId: "👋",
      }
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe(`
    analytics.setAnonymousId("👻");
    analytics.identify("👋");
    💾`);
  });
});
