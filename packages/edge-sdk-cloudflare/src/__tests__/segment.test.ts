import {
  appendAJSCustomConfiguration,
  handleAJS,
  handleBundles,
  handleSettings,
  redactWritekey,
} from "../assetsProxy";
import { Router } from "../router";
import { Segment } from "../segment";
import {
  mockContext,
  mockProfilesApi,
  mockSegmentCDN,
  mockSushiShop,
  mockTapi,
  samplePersonasIncomingRequest,
  samplePersonasIncomingUnsupportedRequest,
} from "./mocks";

describe("integration tests: Proxy Origin", () => {
  beforeEach(() => {
    mockSegmentCDN();
    mockSushiShop();
  });

  it("Proxies origin without modifications", async () => {
    let segment = new Segment(
      { writeKey: "X", routePrefix: "tester" },
      { ajsInjection: false, proxyOrigin: true }
    );

    const request = new Request("https://sushi-shop.com/", {
      headers: { host: "sushi-shop.com" },
    });

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Hello from Sushi Shop 🍣"); // page content is rendered
  });

  it("Does not proxy origin if the flag is off", async () => {
    let segment = new Segment(
      { writeKey: "X", routePrefix: "tester" },
      { proxyOrigin: false }
    );

    const request = new Request("https://sushi-shop.com/", {
      headers: { host: "sushi-shop.com" },
    });

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(404);
    expect(await resp?.text()).toBe("Not Found");
  });
});

describe("integration tests: AJS snippet injection", () => {
  beforeEach(() => {
    mockSegmentCDN();
    mockSushiShop();
  });

  it("AJS Snippet Injection with writekey redaction", async () => {
    let segment = new Segment({ writeKey: "X", routePrefix: "tester" });

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

  it("Avoid AJS snippet injection into non-200 responses from origin", async () => {
    let segment = new Segment({ writeKey: "X", routePrefix: "tester" });

    const request = new Request(
      "https://sushi-shop.com/menu/confit-du-canard",
      {
        headers: { host: "sushi-shop.com" },
      }
    );

    const resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(404);
    const data = await resp?.text();
    expect(data).toContain("Not found");
  });
});

describe("integration tests: Proxy AJS and Assets", () => {
  beforeEach(() => {
    mockSegmentCDN();
    mockSushiShop();
  });

  it("Makes AJS available on the first party domain", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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

  it("AJS: Invalid responses are returned verbatim", async () => {
    let segment = new Segment({
      writeKey: "INVALID_WRITEKEY",
      routePrefix: "tester",
    });

    let request = new Request("https://sushi-shop.com/tester/ajs/13232");
    let resp = await segment.handleEvent(request);

    // 404 from Segment CDN is returned without any modifications
    expect(resp?.status).toBe(404);
    expect(await resp?.text()).toBe(
      "Cannot GET - Invalid path or write key provided."
    ); // Returns the AJS content

    request = new Request(
      "https://sushi-shop.com/tester/v1/projects/anything/settings"
    );

    resp = await segment.handleEvent(request);

    // 404 from Segment CDN is returned without any modifications
    expect(resp?.status).toBe(404);
    expect(await resp?.text()).toBe(
      "Cannot GET - Invalid path or write key provided."
    );
  });

  it("Settings: Configures API host to point to the first-party domain", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

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

  it("Supports custom TAPI endpoint", async () => {
    let segment = new Segment(
      {
        writeKey: "THIS_IS_A_WRITE_KEY",
        routePrefix: "tester",
        trackingApiEndpoint: "https://api.custom.io/v1",
      },
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
    expect(await resp?.text()).toContain("Success from custom endpoint!");
  });
});

describe("integration tests: Personas webhook", () => {
  //@ts-ignore
  const { PROFILES_TEST_NAMESPACE: Profiles } = getMiniflareBindings();

  beforeEach(async () => {
    await Profiles.put("array", "test");
  });

  it("401s if username/password missing or not matching", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });

    // no auth
    let request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      body: JSON.stringify(samplePersonasIncomingRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(401);

    request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("wrong_username:password")}` },
      body: JSON.stringify(samplePersonasIncomingRequest),
    });
    expect(resp?.status).toBe(401);

    request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:wrong_password")}` },
      body: JSON.stringify(samplePersonasIncomingRequest),
    });
    expect(resp?.status).toBe(401);
  });

  it("401s if username password is not configured, but also no auth is passed in", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
    });

    // no auth
    let request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      body: JSON.stringify(samplePersonasIncomingRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(401);
  });

  it("Stores user profile if it does not exist in the storage", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify(samplePersonasIncomingRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(200);
    const data = await Profiles.get(samplePersonasIncomingRequest.userId);
    expect(data).toBe('{"cool_people":true}');
  });

  it("Does not override the already existing audiences", async () => {
    await Profiles.put(
      samplePersonasIncomingRequest.userId,
      '{"mac_users":true}'
    );

    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookUsername: "username",
      engageWebhookPassword: "password",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify(samplePersonasIncomingRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(200);
    const data = await Profiles.get(samplePersonasIncomingRequest.userId);
    expect(JSON.parse(data)).toEqual(
      JSON.parse('{"cool_people":true, "mac_users":true}')
    );
  });

  it("Updates existing audience", async () => {
    await Profiles.put(
      samplePersonasIncomingRequest.userId,
      '{"cool_people":true}'
    );

    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify({
        ...samplePersonasIncomingRequest,
        traits: { cool_people: false },
      }),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(200);
    const data = await Profiles.get(samplePersonasIncomingRequest.userId);
    expect(JSON.parse(data)).toEqual(JSON.parse('{"cool_people":false}'));
  });

  it("Returns 403 if storage is not setup", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify(samplePersonasIncomingRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(403);
  });

  it("Returns 403 if incoming webhook sends a track call", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify(samplePersonasIncomingUnsupportedRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(403);
  });

  it("Returns 501 if feature is not setup", async () => {
    let segment = new Segment(
      {
        writeKey: "THIS_IS_A_WRITE_KEY",
        routePrefix: "tester",
        profilesStorage: Profiles,
      },
      {
        engageIncomingWebhook: false,
      }
    );
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      body: JSON.stringify(samplePersonasIncomingUnsupportedRequest),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(501);
  });

  it("For non-audience payloads, it gracefully returns without acting on the webhook", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      engageWebhookPassword: "password",
      engageWebhookUsername: "username",
    });
    const request = new Request("https://sushi-shop.com/tester/personas", {
      method: "POST",
      headers: { authorization: `Basic ${btoa("username:password")}` },
      body: JSON.stringify({
        ...samplePersonasIncomingRequest,
        context: {
          ...samplePersonasIncomingRequest.context,
          personas: { computation_class: "traits" },
        },
      }),
    });

    const resp = await segment.handleEvent(request);
    expect(resp?.status).toBe(200);
    const data = await Profiles.get(samplePersonasIncomingRequest.userId);
    expect(data).toBe(null);
  });
});

describe("integration tests: Client-side traits", () => {
  //@ts-ignore
  const { PROFILES_TEST_NAMESPACE: Profiles } = getMiniflareBindings();

  beforeEach(async () => {
    mockProfilesApi("123");
    mockSegmentCDN();
  });

  it("Client-side traits: queries profiles API if the profile does not exist on Edge", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.clientSideTraits((t) => ({
      cool: t.cool_people,
    }));

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=sloth; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('{"cool":true}');
  });

  it("Client-side traits: Stores full profile on the edge after querying profile API", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.clientSideTraits((t) => ({
      cool: t.cool_people,
    }));

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=sloth; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const profile = await Profiles.get("user_id:sloth");
    expect(profile).toBe(
      '{"cool_people":true,"mac_user":true,"vancouver_crew":true}'
    );
  });

  it("Client-side traits: Can use the profile info from the Edge", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.clientSideTraits((t) => ({
      cool: t.cool_people,
    }));

    // Profile is already stored on the edge and different from what profile API returns
    await Profiles.put("user_id:sloth", '{"cool_people":false}');
    // Profile on the edge, but not exist on profile API
    await Profiles.put("user_id:ghost", '{"cool_people":true}');

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=sloth; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain('{"cool":false}');

    request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=ghost; ajs_anonymous_id=xyz",
      },
    });
    resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain('{"cool":true}');
  });

  it("Client-side traits: doesn't add any traits if no client-side trait function provided", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });

    await Profiles.put("user_id:sloth", '{"cool_people":false}');

    let request = new Request("https://sushi-shop.com/tester/ajs/13232", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=sloth; ajs_anonymous_id=xyz",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).not.toContain('{"cool":false}');
    expect(data).toContain(';analytics.identify("sloth");');
  });
});

describe("integration tests: Variations", () => {
  //@ts-ignore
  const { PROFILES_TEST_NAMESPACE: Profiles } = getMiniflareBindings();

  beforeEach(async () => {
    mockProfilesApi("123");
    mockSegmentCDN();
    mockSushiShop();
  });

  it("Variations: queries profiles API and delivers the personalized content", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.registerVariation("/menu", (t) => {
      return t.cool_people ? "cool-menu" : "not-so-cool-menu";
    });

    // sloth receives the super cool sushi menu
    let request = new Request("https://sushi-shop.com/menu", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=sloth;",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Super Cool Sushi Menu!");

    // racoon receives the regular sushi menu
    request = new Request("https://sushi-shop.com/menu", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=racoon;",
      },
    });
    resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Regular Sushi Menu!");
  });

  it("Variations: use the Edge DB to deliver personalized content", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.registerVariation("/menu", (t) => {
      return t.good_tippers ? "cool-menu" : "not-so-cool-menu";
    });

    // add profiles to the edge DB
    await Profiles.put("user_id:jimmy", '{"good_tippers":false}');
    await Profiles.put("user_id:joe", '{"good_tippers":true}');

    // sloth receives the super cool sushi menu
    let request = new Request("https://sushi-shop.com/menu", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=joe;",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Super Cool Sushi Menu!");

    // racoon receives the regular sushi menu
    request = new Request("https://sushi-shop.com/menu", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=jimmy;",
      },
    });
    resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Regular Sushi Menu!");
  });

  it("Variations: delivers default content if Profile doesn't exist and variation function returns undefined", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
      profilesStorage: Profiles,
      personasSpaceId: "123",
      personasToken: "nah",
    });
    segment.registerVariation("/menu", (t) => {
      if (!t) {
        return undefined;
      }
      return t.cool_people ? "cool-menu" : "not-so-cool-menu";
    });

    // sloth receives the super cool sushi menu
    let request = new Request("https://sushi-shop.com/menu", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=tim;",
      },
    });
    let resp = await segment.handleEvent(request);

    expect(resp?.status).toBe(200);
    const data = await resp?.text();
    expect(data).toContain("Sushi Menu!");
  });
});

describe("integration tests: Reset endpoint", () => {
  beforeEach(() => {
    mockTapi();
  });

  it("Resets the server-side cookies", async () => {
    let segment = new Segment({
      writeKey: "THIS_IS_A_WRITE_KEY",
      routePrefix: "tester",
    });

    let request = new Request("https://sushi-shop.com/tester/reset");

    let resp = await segment.handleEvent(request);

    // AJS is available on the first party domain
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Success!");
    expect(resp.headers.get("set-cookie")).toContain("ajs_anonymous_id=;");
    expect(resp.headers.get("set-cookie")).toContain("ajs_user_id=;");
    expect(resp.headers.get("set-cookie")).toContain("Max-Age=0;");
  });
});
