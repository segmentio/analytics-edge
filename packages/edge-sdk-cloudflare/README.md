# Segment Edge SDK for Cloudflare Workers

There are two “unsolved” problem with app instrumentation today:

**Problem #1:** Many important events that you want to track happen on the “wild-west” of the client, but collecting those events via the client can lead to low data quality, as events are dropped due to user configurations, browser limitations, and network connectivity issues.

**Problem #2:** Applications need access to realtime (<50ms) user state to personalize the application experience based on advanced computations and segmentation logic that must be executed on the cloud.

The Segment Edge SDK – built on Cloudflare Workers – solves for both. With Segment Edge SDK, developers can collect high-quality first-party data. Developers can also use Segment Edge SDK to access realtime user profiles and state, to deliver personalized app experiences without managing a ton of infrastructure.

## Getting Started

Edge SDK requires you to setup a Cloudflare Worker. You can choose one of the following two methods to setup your worker:

### Running as a full proxy on your main domain

This approach allows the worker to intercept all the request to your website, and subsequently offer few features that are unique to this installation method:

- Automatically inject AJS to every web-pages on your website
- Allow delivering personalized content

To run as a full-proxy, you have to deploy your worker using [Routes](https://developers.cloudflare.com/workers/platform/triggers/routes/). Follow these instructions to setup your worker:

✋ As a pre-requisit, you need to sign-up for a Cloudflare account, and add your domain to Cloudflare so that Cloudflare is able to resolve your domain. Use [these instructions](<https://developers.cloudflare.com/learning-paths/get-started/#domain-resolution-(active-website)>) to setup your website with Cloudflare.

1- Follow the [Get Started Guide](https://developers.cloudflare.com/workers/get-started/guide/) to setup a basic Cloudflare worker using Wrangler, and by choosing the default options offered by Wrangler during the setup.

2- Install the Segment Edge SDK

```
yarn add @segment/edge-sdk-cloudflare
```

3- Update your worker code (`index.ts`) as follows

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
+        routePrefix: "magic", // path prefix for serving Segment assets
+        personasSpaceId: "...", // optional
+        personasToken: "...", // optional
+      }
+    );
+
+    const resp = await segment.handleEvent(request);
+    return resp;
  },
};

```

4- Update `wrangler.toml` file so that the worker intercepts requests to the website:

```diff
name = '...'
main = "src/index.ts"

+ route = "www.your_website.com/*"
```

5- Deploy the worker

```
wrangler publish
```

🎉 Now if you visit your website, all the pages are automatically instrumented with analytics.js

6- (Optional) Setup Cloudflare KV for Profiles Database

- Setup a KV using [these instructions](https://developers.cloudflare.com/workers/wrangler/workers-kv/#create-a-kv-namespace-with-wrangler)
- Update your worker code as follows:

```diff
import { Segment } from "@segment/edge-sdk-cloudflare";

+ export interface Env {
+   MY_KV_NAMESPACE: KVNamespace;
+ }

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const segment = new Segment(
      {
        writeKey: "YOUR_WRITE_KEY",
        routePrefix: "magic",
        personasSpaceId: "...", // optional
        personasToken: "...", // optional
+       profilesStorage: env.MY_KV_NAMESPACE,
      }
    );

    const resp = await segment.handleEvent(request);
    return resp;
  },
};
```

### Running on a sub-domain

This approach runs the worker on a sub-domain of yours, and the worker will only be responsible for first-party delivery of AJS, and delivering client-side traits. But the worker will not intercept individual pages on your main domain, and therefore features such as Personalization or Automatic AJS Injection won't be available.

To run the worker on a sub-domain, you can deploy your worker using these instructions:
1- Follow steps 1-3 from the previous section
2- Update `wrangler.toml` file so that the worker is setup on a sub-domain in our zone

```diff
name = '...'
main = "src/index.ts"

+ routes = [
+ 	{ pattern = "your_sub_domain.your_website.com", custom_domain = true, zone_name = "your_website.com" }
+ ]
```

3- Modify worker code to turn-off full proxy features:

```diff
    const segment = new Segment(
      {
        writeKey: "YOUR_WRITE_KEY",
        routePrefix: "magic",
        personasSpaceId: "...", // optional
        personasToken: "...", // optional
      },
      {
+        ajsInjection: false,
+        edgeVariations: false,
+       proxyOrigin: false,
      }
    );

```

4- Since the AJS injection is not available, you have to add Segment snippet to your website manually. Make sure to modify the standard snippet so it points to your first-party domain:

```diff
- t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";
+ t.src="https://your_sub_domain.your_website.com/<your_prefix>/ajs/<random_uuid>"
```

## API

**Constructor**

```typescript
const segment = new Segment(settings, features);
```

Checkout the JSDoc on each settings, and features parameters.

**`.handleEvent(request: Request)`**
Returns: `Response`

Accepts a Cloudflare incoming Request, and returns a response that could be AJS assets, response from Segment Tracking API, or response from the Origin.

**`.registerVariation(route: string, evaluationFunction: VariationEvaluationFunction)`**
Retruns: `undefined`

Register a variation on the `route`. If a visitor navigates to `route`, we run the evaluationFunction, and fetch the path returned from the function instead of the `route`. If the evaluationFunction returns `undefined`, we then fetch the `route` from the origin.

**`.clientSideTraits(traitsFunc: TraitsFunction)`**
Returns: `undefined`

Registers a function that transform the visitors full `audiences` list to a redacted version, and then deliver the redacted audiences to the client.

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
