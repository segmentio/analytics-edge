export const mockContext = {
  settings: {
    writeKey: "THIS_IS_A_WRITE_KEY",
    routePrefix: "seg",
    personasSpaceId: "test",
    personasToken: "test",
    baseSegmentCDN: "https://cdn.segment.com",
    profilesStorage: {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  },
  logger: { log: () => null } as any,
};

export const mockSegmentCDN = () => {
  // @ts-ignore
  const fetchMock = getMiniflareFetchMock();

  fetchMock.disableNetConnect();

  const origin = fetchMock.get("https://cdn.segment.com");
  origin
    .intercept({
      method: "GET",
      path: "https://cdn.segment.com/analytics.js/v1/THIS_IS_A_WRITE_KEY/analytics.min.js",
    })
    .reply(200, "Analytics JS Code!");

  origin
    .intercept({
      method: "GET",
      path: "https://cdn.segment.com/v1/projects/THIS_IS_A_WRITE_KEY/settings",
    })
    .reply(
      200,
      `{
      "integrations": {
        "Segment.io": {
          "apiKey": "THIS_IS_A_WRITE_KEY"",
          "apiHost": "api.segment.io/v1"
        }
      },
      "metrics": {
        "sampleRate": 0.1,
        "host": "api.segment.io/v1"
      },
      "remotePlugins": []
    }
    `
    );

  origin
    .intercept({
      method: "GET",
      path: "https://cdn.segment.com/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js",
    })
    .reply(200, "Schema filter 👨🏻‍💻");

  origin
    .intercept({
      method: "GET",
      path: "https://cdn.segment.com/next-integrations/actions/edge_sdk/ed984d68b220640a83ac.js",
    })
    .reply(200, "Edge SDK destination (Actions) 💥");

  origin
    .intercept({
      method: "GET",
      path: "https://cdn.segment.com/next-integrations/integrations/edge/2.2.4/edge.dynamic.js.gz",
    })
    .reply(200, "Edge SDK destination (Legacy) 👴");
};

export const mockSushiShop = () => {
  // @ts-ignore
  const fetchMock = getMiniflareFetchMock();

  fetchMock.disableNetConnect();

  const origin = fetchMock.get("https://sushi-shop.com");
  origin
    .intercept({
      method: "GET",
      path: "/",
    })
    .reply(200, wrapInHTML("Hello from Sushi Shop 🍣"), {
      headers: { "content-type": "text/html" },
    });

  origin
    .intercept({
      method: "GET",
      path: "/menu",
    })
    .reply(200, wrapInHTML("Sushi Menu!"), {
      headers: { "content-type": "text/html" },
    });

  origin
    .intercept({
      method: "GET",
      path: "/logo.png",
    })
    .reply(200, "🎨", { headers: { "content-type": "image/png" } });

  origin
    .intercept({
      method: "GET",
      path: "/cool-menu",
    })
    .reply(200, wrapInHTML("Super Cool Sushi Menu!"), {
      headers: { "content-type": "text/html" },
    });

  origin
    .intercept({
      method: "GET",
      path: "/not-so-cool-menu",
    })
    .reply(200, wrapInHTML("Regular Sushi Menu!"), {
      headers: { "content-type": "text/html" },
    });
};

export const mockTapi = () => {
  // @ts-ignore
  const fetchMock = getMiniflareFetchMock();
  //@ts-ignore - getMiniflareFetchMock is global defined by miniflare

  fetchMock.disableNetConnect();

  const origin = fetchMock.get("https://api.segment.io");
  let data;
  origin
    .intercept({
      method: "POST",
      path: (path: string) => path.startsWith("/v1"),
      body: (body: string) => {
        // TODO: Add some logic to only respond to valid
        // TAPI calls, after this PR merges: https://github.com/cloudflare/miniflare/pull/423/files
        return true;
      },
    })
    .reply(200, "Success!");
};

export const mockProfilesApi = (personasSpaceId: string) => {
  // @ts-ignore
  const fetchMock = getMiniflareFetchMock();
  //@ts-ignore - getMiniflareFetchMock is global defined by miniflare

  fetchMock.disableNetConnect();

  const origin = fetchMock.get(`https://profiles.segment.com`);
  origin
    .intercept({
      method: "GET",
      path: `/v1/spaces/${personasSpaceId}/collections/users/profiles/user_id:sloth/traits?limit=200&class=audience`,
    })
    .reply(200, sampleProfilesAPIResponse);

  origin
    .intercept({
      method: "GET",
      path: `/v1/spaces/${personasSpaceId}/collections/users/profiles/user_id:racoon/traits?limit=200&class=audience`,
    })
    .reply(200, {
      ...sampleProfilesAPIResponse,
      traits: { cool_people: false },
    });
};

const wrapInHTML = (content: string) => `<!doctype html>
<html lang=en>
  <head>
    <meta charset=utf-8>
  </head>
  <body>
    ${content}
  </body>
</html>`;

export const samplePersonasIncomingRequest = {
  anonymousId: "eml_59bb5025c368374f702e578cfee8a048c9244c9f",
  channel: "server",
  context: {
    library: {
      name: "unknown",
      version: "unknown",
    },
    personas: {
      computation_class: "audience",
      computation_id: "aud_24vZy7jA4QGrYm6vtx5xMlHhy9Q",
      computation_key: "5009052",
      namespace: "spa_1hZFbc8rjREtD41YL5Ici3Ox4pY",
      space_id: "spa_1hZFbc8rjREtD41YL5Ici3Ox4pY",
    },
  },
  integrations: {
    All: false,
    Warehouses: {
      all: false,
    },
  },
  messageId: "personas_123",
  originalTimestamp: "2022-10-10T00:02:50.0888384Z",
  projectId: "xyz",
  receivedAt: "2022-10-10T00:02:50.871Z",
  sentAt: null,
  timestamp: "2022-10-10T00:02:50.088Z",
  traits: {
    cool_people: true,
  },
  type: "identify",
  userId: "coolio",
  version: 2,
  writeKey: "THIS_IS_A_WRITE_KEY",
};

export const sampleProfilesAPIResponse = {
  traits: {
    cool_people: true,
    mac_user: true,
    vancouver_crew: true,
  },
  cursor: {
    url: "",
    has_more: false,
    next: "",
    limit: 200,
  },
};
