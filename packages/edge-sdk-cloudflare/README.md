# Segment Edge SDK for Cloudflare Workers

## Getting Started

Basic worker code:

```typescript
export default {
  async fetch(request, env) {
    return new Response("Hello World!");
  },
};
```

Usage with Segment SDK:

```typescript
import { Segment } from "@segment/edge-sdk-cloudflare";
import type { Env as SDKEnv } from "@segment/edge-sdk-cloudflare";

export default {
    async fetch(request, env) {
    const segment = new Segment(
        {
        writeKey: env.SEGMENT_WRITE_KEY,
        personasSpaceId: env.PERSONAS_SPACE_ID,
        personasToken: env.PERSONAS_TOKEN
        routePrefix: "segment",
        }
    );

    const resp = await segment.handleEvent(request, env);
    return resp;
    },
};
```

## How to configure your worker

Edge SDK requires you to setup a Cloudflare Worker. You can choose one of the following two methods to setup your worker:

**Running as a full proxy on your domain**
This approach allows the worker to intercept all the request to your website, and subsequently offer few features:

- Inject AJS to the web-pages on your website
- Allow delivering personalized content

To run as a full-proxy, you have to deploy your worker using [Routes](https://developers.cloudflare.com/workers/platform/triggers/routes/). Follow these instructions to setup your worker:

- As a pre-requisit, you need to have a Cloudflare account, and already added your domain to Cloudflare, and Cloudflare is able to resolve your domain. Use [these instructions](<https://developers.cloudflare.com/learning-paths/get-started/#domain-resolution-(active-website)>) to setup your website with Cloudflare.

- Follow the [Get Started Guide](https://developers.cloudflare.com/workers/get-started/guide/) to setup a Cloudflare worker.

- Install the Segment Edge SDK

```
yarn add @segment/edge-sdk-cloudflare
```

- Update your worker code as follows

```diff
+ import { Segment } from "@segment/edge-sdk-cloudflare";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
-    return new Response("Hello World!");
+    const segment = new Segment(
+      {
+        writeKey: "YOUR_WRITE_KEY",
+        routePrefix: "magic",
+      }
+    );
+
+    const resp = await segment.handleEvent(request);
+    return resp;
  },
};

```

- Update `wrangler.toml` file so that the worker intercepts requests to the website

```diff
name = '...'
main = "src/index.ts"

+ route = "www.your_website.com/*"
```

- Deploy the worker

```
wrangler publish
```

**Running on a sub-domain**
This approach runs the worker on a sub-domain, and the worker will only be responsible for first-party delivery of AJS, and delivering client-side traits. But given the worker won’t have access to individual pages, features such as Edge personalization or Automatic AJS injection won’t be available.

To run the worker on a sub-domain you can deploy your worker using Custom Domains. Follow these instructions to setup your worker:
[TBD]

## API

**Constructor**

```typescript
const segment = new SegmentEdge(settings, features);
```

Checkout the JSDoc on each settings, and features parameters.

## SDK Features

### Collecting Edge Context ( `features.edgeContext` )

The SDK will automatically capture the information available on the edge and include them in the `context.edge` object of the Segment event.

👉 the `context.edge` will be available on `track`, `identify` and `page` calls
👉 The following information will be collected:

- region
- regionCode
- city
- country
- continent
- postalCode
- latitude
- longitude
- timezone

### Automatic Injection of AJS to pages ( `features.ajsInjection` )

The SDK will automatically adds AJS snippet to the HEAD of each page.

👉 This feature should only be used if the SDK is being used as a full proxy of the origin.

### Server-side Cookies ( `features.serverSideCookies` )

The SDK will set `ajs_anonymous_id` and `ajs_user_id` cookies as HTTPOnly. This feature will be helpful in few instances:

- Prevent Safari browsers from clearing those ids, as currently Safari limits the TTL of JS accessible storage to 7 days

There are few caveats around the server-side cookies:
👉 Users visiting a website for the first time will get an `anonymousId` that is generated on the Edge, and is stored as HTTPOnly cookie
👉 If user is already identified on a given browser ( has either of anonymousId or userId ), the Edge SDK will respect those identities, but convert those from client-side cookie to server-side cookie
👉 If an identity of the user is updated through a call to `identify` / `track` / `page` / `group` methods, the identity is intially stored as a client-side cookie, and when the browser receives the response back from Edge, the cookie will be promoted to a server-side cookie
👉 If the identity of the user is updated through `analytics.setAnonymousId()` or ` analytics.user().id(``'``…') `, the identity is initially set as a client-side cookie, and on the next request ( either a tracking call, or next time AJS loads ) the cookie is promoted to HTTPOnly cookie
👉 If the identity of the user is cleared using `analytics.reset()`, then you have to send a subsequent tracking call to clear the HTTPOnly cookies ( TBD/Fix )

### Redact writekeys ( `features.redactWritekey` )

SDK can scrub the writekey from AJS, Settings, and calls to the tracking API, and then adds the writeKey to the events from the Edge. While writeKeys are public, you may choose to not expose the writeKeys on the browser.

### Edge Variation ( `features.edgeVariations` )

This is a personalization feature and requires the Edge SDK to be setup as a full proxy. When this feature is turned on, you can use the `registerVariation` to chose what content to serve on a given route:

```typescript
segment.registerVariation("/", (audiences) => {
  if (!audiences) {
    return;
  }
  return audiences.vancouver_crew ? "/van" : "/sf";
});
```

The `registerVariation` accepts two paramters:

- `route` : this is the route that serves the personalized content
- `evaluationFunction` : this is the method that determines where the personalized content is coming from, and should return a path in the origin that contains the personalized content. The evaluation function receives the list of `audiences` for the current visitor, and can choose the origin path using the information in audiences. If the function returns `undefined`, the SDK just serves the default content from origin.

### Client Side Traits ( `features.clientSideTraits` )

The SDK can expose a reduced set of user traits to the client. By using the `clientSideTraits` method, the Edge SDK transforms the `audiences` object to a reduced form that can be exposed to the client, and then sets the reduced audiences as a client-side trait in Analytics.js.

```typescript
segment.clientSideTraits((audiences) => {
  return {
    group_a: audiences.vancouver_crew,
  };
});
```

### Engage Incoming Webhook ( `features.engageIncomingWebhook` )

This feature exposes a webhook that can be used by Twilio Engage to send audiences data to the Cloudflare worker.

### Using Profiles API for identity resolution ( `features.useProfilesAPI` )

The SDK will use the Twilio Segment Profiles API, if the user profile is not available on the Edge. If turning on this feature, you should provide the Profiles API crendentials during the SDK initialization.

### Proxy Origin (`proxyOrigin`)

This feature will allow the SDK to proxy all the calls to the origin. You should only use this feature if running the SDK as a full proxy.
