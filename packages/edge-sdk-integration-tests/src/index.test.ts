import type { EdgeSDKFeatures, EdgeSDKSettings } from "@segment/edge-sdk";
import { MockCdnServer } from "./mocks/mockCdn";
import { MockOriginServer } from "./mocks/mockOrigin";
import { EventPayload, MockTrackingApi } from "./mocks/mockTrackingApi";
import { startService as startCloudflareService } from "./cloudflare-workers/setup";
import { startService as startFastlyService } from './fastly/setup';
import { Service } from './service';

const EdgeSettingsHeader = "x-segment-edge-settings";
const EdgeFeaturesHeader = "x-segment-edge-features";

const portMappings = {
  origin: 3001,
  cdn: 3002,
  tapi: 3003,
};

const environments = new Map([
  ['Cloudflare Workers', startCloudflareService],
  ['Fastly Compute@Edge', startFastlyService],
])

environments.forEach((startService, environment) => {

  describe(`Edge SDK in ${environment}`, () => {
    let service: Service;

    beforeAll(async () => {
      service = await startService();
    });

    afterAll(async () => {
      await service.stop();
    });

    describe("origin proxy", () => {
      let edgeSDKSettings: EdgeSDKSettings;

      let mockOriginServer: MockOriginServer;
      beforeAll(async () => {
        // Setup mock origin
        mockOriginServer = new MockOriginServer({ port: portMappings.origin });
        await mockOriginServer.start();
        edgeSDKSettings = {
          ...service.edgeSdkSettings,
          writeKey: "FAKE_WRITE_KEY",
          routePrefix: "seg",
        };
      });

      afterAll(async () => {
        // Tear down mock origin
        await mockOriginServer.stop();
      });

      it('proxies origin without modifications', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          ajsInjection: false,
          proxyOrigin: true
        }
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const html = await workerResponse.text();
        expect(html).toContain('Hello from the customer origin!');
      });

      it('does not proxy origin if the flag is off', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          proxyOrigin: false
        }
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(404);
        const html = await workerResponse.text();
        expect(html).toContain('Not Found');
      });
    });

    describe("ajs snippet injection", () => {
      let edgeSDKSettings: EdgeSDKSettings;

      let mockOriginServer: MockOriginServer;
      beforeAll(async () => {
        // Setup mock origin
        mockOriginServer = new MockOriginServer({ port: portMappings.origin });
        await mockOriginServer.start();
        edgeSDKSettings = {
          ...service.edgeSdkSettings,
          writeKey: "FAKE_WRITE_KEY",
          routePrefix: "seg",
        };
      });

      afterAll(async () => {
        // Tear down mock origin
        await mockOriginServer.stop();
      });

      it('AJS snippet injection with writeKey redaction', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const html = await workerResponse.text();
        expect(html).toContain('analytics.load("REDACTED");'); // write key is redacted
        expect(html).toContain('analytics._writeKey="REDACTED";'); // write key is redacted
        expect(html).toContain('t.src="https://customer.com/seg/ajs/'); // AJS URL excluding the randomized bit
        expect(html).toContain('analytics._cdn = "https://customer.com/seg"'); // CDN is configured properly
        expect(html).toContain("analytics.page()"); // There is a default page call

        expect(html).toContain('Hello from the customer origin!'); // page content is rendered
      });

      it('AJS snippet injection without writeKey redaction', async () => {
        const writeKey = edgeSDKSettings.writeKey;
        expect(writeKey).not.toBe('REDACTED');
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          redactWritekey: false
        };
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const html = await workerResponse.text();
        expect(html).toContain(`analytics.load("${writeKey}");`); // write key is not redacted
        expect(html).toContain(`analytics._writeKey="${writeKey}";`); // write key is not redacted
        expect(html).toContain('t.src="https://customer.com/seg/ajs/'); // AJS URL excluding the randomized bit
        expect(html).toContain('analytics._cdn = "https://customer.com/seg"'); // CDN is configured properly
        expect(html).toContain("analytics.page()"); // There is a default page call

        expect(html).toContain('Hello from the customer origin!'); // page content is rendered
      });

      it('AJS snippet injection respects the feature flag', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          ajsInjection: false
        };
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const html = await workerResponse.text();
        expect(html).not.toContain('analytics'); // no mention of analytics on page
        expect(html).toContain('Hello from the customer origin!'); // page content is rendered
      });

      it('Avoid AJS snippet injection into non-200 responses from origin', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/some-fake-path", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(404);
        const html = await workerResponse.text();
        expect(html).not.toContain('analytics'); // no mention of analytics on page
        expect(html).toContain('Unknown origin resource'); // page content is rendered
      });

      it('AJS snippet injection with disabled page call', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify({ ...edgeSDKSettings, snippetInitialPageView: false }),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const html = await workerResponse.text();
        expect(html).toContain('analytics.load("REDACTED");'); // write key is redacted
        expect(html).toContain('analytics._writeKey="REDACTED";'); // write key is redacted
        expect(html).toContain('t.src="https://customer.com/seg/ajs/'); // AJS URL excluding the randomized bit
        expect(html).toContain('analytics._cdn = "https://customer.com/seg"'); // CDN is configured properly
        expect(html).not.toContain("analytics.page()"); // There is no page call

        expect(html).toContain('Hello from the customer origin!'); // page content is rendered
      });
    });

    describe("assets proxy", () => {
      let mockCdnServer: MockCdnServer;
      let edgeSDKSettings: EdgeSDKSettings;
      beforeAll(async () => {
        // Setup mock CDN
        mockCdnServer = new MockCdnServer({ port: portMappings.cdn, validWriteKeys: ['FAKE_WRITE_KEY'] });
        await mockCdnServer.start();
        edgeSDKSettings = {
          ...service.edgeSdkSettings,
          writeKey: "FAKE_WRITE_KEY",
          baseSegmentCDN: `http://${mockCdnServer.host}`,
          routePrefix: "seg",
        }
      });

      afterAll(async () => {
        // Tear down mock CDN
        await mockCdnServer.stop();
      });

      it('Makes AJS available on the first party domain', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {}
        let workerResponse = await service.fetch("http://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain("Analytics JS Code!"); // Original AJS Code exists

        workerResponse = await service.fetch("http://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain("Segment.io"); // Returns settings content

        workerResponse = await service.fetch("http://customer.com/seg/analytics-next/bundles/core.bundle.1231223.js", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain("Core bundle 👨🏻‍💻"); // Returns AJS core bundles

        workerResponse = await service.fetch("http://customer.com/seg/next-integrations/integrations/segment-integration/1.0.0/segment-integration.js.gz", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain("Legacy destination 👴"); // Returns classic destinations

        workerResponse = await service.fetch("http://customer.com/seg/next-integrations/actions/segment-plugin/1231223.js", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain("Action destination 💥"); // Returns action destinations
      });

      it('AJS: Configures the AJS CDN correctly in AJS code', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {}
        const workerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });
        expect(workerResponse.status).toBe(200);
        expect(await workerResponse.text()).toContain('analytics._cdn = "https://customer.com/seg');
      });

      it('AJS: Configures AJS with Id cookies that exist in the request', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {}
        const workerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com',
            cookie: "ajs_user_id=123; ajs_anonymous_id=xyz"
          },
        });
        expect(workerResponse.status).toBe(200);
        const ajs = await workerResponse.text();
        expect(ajs).toContain('analytics.setAnonymousId("xyz");');
        expect(ajs).toContain('analytics.identify("123");');
      });

      it('AJS: generates anonymousId automatically if it is not already part of request cookies', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {}
        const workerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com',
          },
        });
        expect(workerResponse.status).toBe(200);
        const ajs = await workerResponse.text();
        expect(ajs).toContain('analytics.setAnonymousId("');
        expect(ajs).not.toContain('analytics.identify("123");');
      });

      it('AJS: should not configure user id if server-side cookie and client-side traits feature is disabled', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          serverSideCookies: false,
          clientSideTraits: false
        }
        const workerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com',
            cookie: "ajs_user_id=123; ajs_anonymous_id=xyz"
          },
        });
        expect(workerResponse.status).toBe(200);
        const ajs = await workerResponse.text();
        expect(ajs).toContain('analytics._cdn = "https://customer.com/seg');
        expect(ajs).not.toContain('analytics.setAnonymousId("xyz");');
        expect(ajs).not.toContain('analytics.identify("123");');
      });

      it('AJS: should set server-side cookies when returning AJS', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com',
            cookie: "ajs_user_id=123; ajs_anonymous_id=xyz"
          },
        });
        expect(workerResponse.status).toBe(200);
        const ajs = await workerResponse.text();
        expect(ajs).toContain('Analytics JS Code!');
        expect(workerResponse.headers.get('set-cookie')).toContain('ajs_user_id=123');
        expect(workerResponse.headers.get('set-cookie')).toContain('ajs_anonymous_id=xyz');
        expect(workerResponse.headers.get('set-cookie')).toContain('HttpOnly');
        expect(workerResponse.headers.get('set-cookie')).toContain('Domain=customer.com');
      });

      it('AJS: invalid responses are returned verbatim', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const ajsWorkerResponse = await service.fetch("https://customer.com/seg/ajs/111-111-111-111", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify({ ...edgeSDKSettings, writeKey: 'INVALID_WRITEKEY' }),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures)
          },
        });
        // 404 from Segment CDN is returned without any modifications
        expect(ajsWorkerResponse.status).toBe(404);
        const ajs = await ajsWorkerResponse.text();
        expect(ajs).toBe('Cannot GET - Invalid path or write key provided.');

        const settingsWorkerResponse = await service.fetch("https://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify({ ...edgeSDKSettings, writeKey: 'INVALID_WRITEKEY' }),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures)
          },
        });
        // 404 from Segment CDN is returned without any modifications
        expect(settingsWorkerResponse.status).toBe(404);
        const settings = await settingsWorkerResponse.text();
        expect(settings).toBe('Cannot GET - Invalid path or write key provided.');
      });

      it('Settings: configures API host to point to the first-party domain', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const settings = await workerResponse.json() as any;
        expect(settings.integrations['Segment.io'].apiHost).toBe('customer.com/seg/evs'); // API host is set to 1st party domain
      });

      it('Settings: redacts the writeKey in settings if the flag is set to true', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = { redactWritekey: true };
        const workerResponse = await service.fetch("https://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const settings = await workerResponse.json() as any;
        expect(settings.integrations['Segment.io'].apiKey).toBe('REDACTED');
      });

      it('Settings: does not redact the writeKey in settings if the flag is set to false', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = { redactWritekey: false };
        const workerResponse = await service.fetch("https://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const settings = await workerResponse.json() as any;
        expect(settings.integrations['Segment.io'].apiKey).toBe(edgeSDKSettings.writeKey);
        expect(settings.integrations['Segment.io'].apiKey).not.toBe('REDACTED');
      });

      it('Settings: should allow access from any origin', async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {};
        const workerResponse = await service.fetch("https://customer.com/seg/v1/projects/anything/settings", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const settings = await workerResponse.json() as any;
        expect(settings.integrations['Segment.io']).toBeDefined();
        expect(workerResponse.headers.get('access-control-allow-origin')).toBe('*');
      });
    });

    describe("tapi handler", () => {
      const snapshotMatcher = {
        context: expect.objectContaining({
          library: expect.objectContaining({
            version: expect.any(String),
          }),
          edge: expect.any(Object),
        }),
      };

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

      let mockTrackingApi: MockTrackingApi;
      let edgeSDKSettings: EdgeSDKSettings;
      beforeEach(async () => {
        // Setup mock tracking API
        mockTrackingApi = new MockTrackingApi({ port: portMappings.tapi });
        await mockTrackingApi.start();
        edgeSDKSettings = {
          ...service.edgeSdkSettings,
          writeKey: "",
          trackingApiEndpoint: `http://${mockTrackingApi.host}/v1`,
          routePrefix: "seg",
        }
      });

      afterEach(async () => {
        // Tear down mock tracking API
        await mockTrackingApi.stop();
      });


      it("Proxies TAPI", async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          edgeContext: false
        };
        const tapiEvents: EventPayload[] = [];
        mockTrackingApi.on("event", (event) => {
          tapiEvents.push(event);
        });

        const workerResponse = await service.fetch("http://customer.com/seg/evs/p", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
          method: "POST",
          body: JSON.stringify({ type: "page" }),
        });
        await workerResponse.text();

        expect(workerResponse.status).toBe(200);
        expect(tapiEvents.length).toBe(1);
        expect(tapiEvents[0].path).toBe("/v1/p");
        expect(tapiEvents[0].method).toBe("POST");
        expect(tapiEvents[0].event).toMatchInlineSnapshot(
          {
            context: expect.objectContaining({
              library: expect.objectContaining({
                version: expect.any(String),
              }),
            })
          },
          `
          {
            "_metadata": {
              "jsRuntime": "cloudflare-worker",
            },
            "context": ObjectContaining {
              "library": ObjectContaining {
                "version": Any<String>,
              },
            },
            "type": "page",
          }
        `
        );
      });

      it("Enrich identify calls with Edge traits", async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {
          edgeContext: true
        };
        const tapiEvents: EventPayload[] = [];
        mockTrackingApi.on("event", (event) => {
          tapiEvents.push(event);
        });

        const workerResponse = await service.fetch("http://customer.com/seg/evs/i", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
          },
          method: "POST",
          body: JSON.stringify(reqBodyFixture),
        });
        await workerResponse.text();

        expect(workerResponse.status).toBe(200);
        expect(tapiEvents.length).toBe(1);
        expect(tapiEvents[0].path).toBe("/v1/i");
        expect(tapiEvents[0].method).toBe("POST");
        expect(tapiEvents[0].event).toMatchInlineSnapshot(
          {
            context: expect.objectContaining({
              library: expect.objectContaining({
                version: expect.any(String),
              }),
              edge: expect.any(Object),
            }),
          },
          `
          {
            "_metadata": {
              "jsRuntime": "cloudflare-worker",
            },
            "anonymousId": "👻",
            "context": ObjectContaining {
              "edge": Any<Object>,
              "library": ObjectContaining {
                "version": Any<String>,
              },
            },
            "integrations": {
              "Segment.io": true,
            },
            "messageId": "ajs-next-f142195b60efd67506bd5c4f7a4ffa99",
            "timestamp": "2022-10-06T06:08:42.057Z",
            "traits": {
              "isCool": "no",
            },
            "type": "identify",
            "userId": "🤿",
          }
        `
        );
      });

      it("Inject writekey to the headers", async () => {
        const tapiEvents: EventPayload[] = [];
        mockTrackingApi.on("event", (event) => {
          tapiEvents.push(event);
        });

        const workerResponse = await service.fetch("http://customer.com/seg/evs/p", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
          },
          method: "POST",
          body: JSON.stringify({ type: "page", writeKey: "REDACTED" }),
        });
        await workerResponse.text();

        expect(workerResponse.status).toBe(200);
        expect(tapiEvents.length).toBe(1);
        expect(tapiEvents[0].path).toBe("/v1/p");
        expect(tapiEvents[0].method).toBe("POST");
        expect(tapiEvents[0].headers["authorization"]).toBe("Basic Og==");
        expect(tapiEvents[0].event.writeKey).toBeUndefined();
      });

      it("Injects metadata into the body", async () => {
        const tapiEvents: EventPayload[] = [];
        mockTrackingApi.on("event", (event) => {
          tapiEvents.push(event);
        });

        const workerResponse = await service.fetch("http://customer.com/seg/evs/p", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
          },
          method: "POST",
          body: JSON.stringify(reqBodyFixture),
        });
        await workerResponse.text();

        expect(workerResponse.status).toBe(200);
        expect(tapiEvents.length).toBe(1);
        expect(tapiEvents[0].path).toBe("/v1/p");
        expect(tapiEvents[0].method).toBe("POST");
        expect(tapiEvents[0].event._metadata.jsRuntime).toBe("cloudflare-worker");
        const [edgeVersion, ajsVersion] = tapiEvents[0].event.context.library.version.split(':');
        expect(edgeVersion).toMatch(/edge-\d*/);
        expect(ajsVersion).toMatch(reqBodyFixture.context.library.version);
      });
    });

    describe("reset endpoint", () => {
      let edgeSDKSettings: EdgeSDKSettings;

      beforeAll(() => {
        edgeSDKSettings = {
          ...service.edgeSdkSettings,
          writeKey: "FAKE_WRITE_KEY",
          routePrefix: "seg",
        };
      });

      it("resets the server-side cookies", async () => {
        const edgeSDKFeatures: Partial<EdgeSDKFeatures> = {}
        const workerResponse = await service.fetch("https://customer.com/seg/reset", {
          headers: {
            [EdgeSettingsHeader]: JSON.stringify(edgeSDKSettings),
            [EdgeFeaturesHeader]: JSON.stringify(edgeSDKFeatures),
            host: 'customer.com'
          },
        });

        expect(workerResponse.status).toBe(200);
        const data = await workerResponse.text();
        expect(data).toContain('Success!');
        expect(workerResponse.headers.get("set-cookie")).toContain("ajs_anonymous_id=;");
        expect(workerResponse.headers.get("set-cookie")).toContain("ajs_user_id=;");
        expect(workerResponse.headers.get("set-cookie")).toContain("Max-Age=0;");
      });
    });
  });
});