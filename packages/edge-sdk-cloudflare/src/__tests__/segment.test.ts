import {
  appendAJSCustomConfiguration,
  handleAJS,
  handleBundles,
  handleSettings,
  redactWritekey,
} from "../assetsProxy";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext, mockSegmentCDN, mockSushiShop, mockTapi } from "./mocks";

describe("integration tests: AJS snippet injection", () => {
  beforeEach(() => {
    mockSegmentCDN();
    mockSushiShop();
  });

  it("AJS Snippet Injection with writekey redaction", async () => {
    let segment = new Segment({ writeKey: "X", routePrefix: "tester" }, {});

    const request = new Request("https://sushi-shop.com/", {
      headers: { host: "sushi-shop.com" },
    });

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('analytics.load("REDACTED");'); // write key is redacted
    expect(data).toContain('analytics._writeKey="REDACTED";'); // write key is redacted
    expect(data).toContain('t.src="https://sushi-shop.com/tester/ajs/'); // AJS URL excluding the randomized bit
    expect(data).toContain('analytics._cdn = "https://sushi-shop.com/tester"'); // CDN is configured properly

    expect(data).toContain("Hello from Sushi Shop 🍣"); // page content is rendered
  });

  it("AJS Snippet Injection without writekey redaction", async () => {
    let segment = new Segment(
      { writeKey: "X", routePrefix: "tester" },
      { redactWritekey: false }
    );

    const request = new Request("https://sushi-shop.com/", {
      headers: { host: "sushi-shop.com" },
    });

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('analytics.load("X");'); // write key is redacted
    expect(data).toContain('analytics._writeKey="X";'); // write key is redacted
    expect(data).toContain('t.src="https://sushi-shop.com/tester/ajs/'); // AJS URL excluding the randomized bit
    expect(data).toContain('analytics._cdn = "https://sushi-shop.com/tester"'); // CDN is configured properly

    expect(data).toContain("Hello from Sushi Shop 🍣"); // page content is rendered
  });

  it("AJS Snippet Injection respects the feature flag", async () => {
    let segment = new Segment(
      { writeKey: "X", routePrefix: "tester" },
      { ajsInjection: false }
    );

    const request = new Request("https://sushi-shop.com/", {
      headers: { host: "sushi-shop.com" },
    });

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).not.toContain("analytics"); // no mention of analytics on the page
    expect(data).toContain("Hello from Sushi Shop 🍣"); // page content is rendered
  });
});

describe("integration tests: Proxy AJS and Assets", () => {
  beforeEach(() => {
    mockSegmentCDN();
    mockSushiShop();
  });

  it("Makes AJS available on the first party domain", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232");
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Analytics JS Code!"); // Returns the AJS content

    request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings"
    );

    resp = await segment.handleEvent(request);

    // Settings are available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Segment.io"); // Returns settings content ( integrations obj )

    request = new Request(
      "https://sushi-shop.com/tester/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
    );

    resp = await segment.handleEvent(request);

    // Other bundles are available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Schema filter 👨🏻‍💻"); // Returns the AJS content
  });

  it("AJS: Configures the AJS CDN correctly in AJS code", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: { host: "sushi-shop.com" },
    });
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain(
      'analytics._cdn = "https://sushi-shop.com/tester'
    );
  });

  it("AJS: Configures AJS with Id cookies that exist in the request", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=123; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('analytics.setAnonymousId("xyz");');
    expect(data).toContain('analytics.identify("123");');
  });

  it("AJS: generates anonymousId automatically if it is not already part of request cookies", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
      },
    });
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("analytics.setAnonymousId("); // anonymousId is set
    expect(data).not.toContain('analytics.identify("123");'); // identify is not called
  });

  it("AJS: It should not configure user id if server-side cookie and client-side traits feature is disabled", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      { serverSideCookies: false, clientSideTraits: false }
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=123; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('analytics._cdn = "https://sushi-shop.com/tester');
    expect(data).not.toContain('analytics.setAnonymousId("xyz");');
    expect(data).not.toContain('analytics.identify("123");');
  });

  it("AJS: It should set server-side cookies when returning AJS", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=123; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Analytics JS Code!");
    expect(resp?.headers.get("set-cookie")).toContain("ajs_user_id=123");
    expect(resp?.headers.get("set-cookie")).toContain("ajs_anonymous_id=xyz");
    expect(resp?.headers.get("set-cookie")).toContain("HttpOnly");
    expect(resp?.headers.get("set-cookie")).toContain("Domain=sushi-shop.com;");
  });

  it("Settings: Configures API host to point to the first-party domain", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    const request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings",
      {
        headers: { host: "sushi-shop.com" },
      }
    );

    const resp = await segment.handleEvent(request);

    // Settings are available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Segment.io"); // Returns settings content ( integrations obj )
    expect(data).toContain("sushi-shop.com/tester/evs"); // API host is set to first party domain
    expect(data).not.toContain("api.segment.io"); // there is no pointers to segment.io
  });

  it("Settings: redacts the writekey in settings if the flag is set", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {
        redactWritekey: true,
      }
    );

    const request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings",
      {
        headers: { host: "sushi-shop.com" },
      }
    );

    const resp = await segment.handleEvent(request);

    // Settings are available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Segment.io"); // Returns settings content ( integrations obj )
    expect(data).toContain("REDACTED"); // API host is set to first party domain
    expect(data).not.toContain("THIS_IS_A_WRITE_KEY"); // there is no pointers to segment.io
  });

  it("Settings: does not redact the writekey in settings if the flag is set to false", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {
        redactWritekey: false,
      }
    );

    const request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings",
      {
        headers: { host: "sushi-shop.com" },
      }
    );

    const resp = await segment.handleEvent(request);

    // Settings are available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Segment.io"); // Returns settings content ( integrations obj )
    expect(data).toContain("THIS_IS_A_WRITE_KEY"); // API host is set to first party domain
    expect(data).not.toContain("REDACTED"); // there is no pointers to segment.io
  });

  it("Settings: should allow access from any origin", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      {}
    );

    const request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings",
      {
        headers: { host: "sushi-shop.com" },
      }
    );

    const resp = await segment.handleEvent(request);

    // Settings are available on the first party domain
    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Segment.io"); // Returns settings content ( integrations obj )
    expect(resp?.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("integration tests: Proxy TAPI", () => {
  beforeEach(() => {
    mockTapi();
  });

  it("Makes AJS available on the first party domain", async () => {
    let segment = new Segment(
      { writeKey: "THIS_IS_A_WRITE_KEY", routePrefix: "tester" },
      { redactWritekey: false, edgeContext: false }
    );

    let request = new Request("https://sushi-shop.com/tester/evs/t", {
      method: "POST",
      body: JSON.stringify({
        type: "track",
        event: "test",
        properties: {},
        writeKey: "THIS_IS_A_WRITE_KEY",
      }),
    });

    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Success!");
  });
});
