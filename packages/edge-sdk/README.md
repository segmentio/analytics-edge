# Segment Edge SDK for Cloudflare Workers

There are two “unsolved” problem with app instrumentation today:

**Problem #1:** Many important events that you want to track happen on the “wild-west” of the client, but collecting those events via the client can lead to low data quality, as events are dropped due to user configurations, browser limitations, and network connectivity issues.

**Problem #2:** Applications need access to realtime (<50ms) user state to personalize the application experience based on advanced computations and segmentation logic that must be executed on the cloud.

The Segment Edge SDK – built on Cloudflare Workers – solves for both. With Segment Edge SDK, developers can collect high-quality first-party data. Developers can also use Segment Edge SDK to access realtime user profiles and state, to deliver personalized app experiences without managing a ton of infrastructure.

## Getting Started

Edge SDK requires you to setup a Cloudflare Worker. You can choose one of the following two methods to setup your worker:

### Running as a full reverse proxy on your main domain

This approach allows the worker to intercept all the request to your website, and forward them to one or more backend servers (origins). This can be useful for delivering personalized content, as the worker can use information about the client, such as user identity or traits, to tailor the response from the backend server, such as delivering a customized version of the page to the client. Furthermore, the worker can automatically inject analytics.js to the webpages, in order to make instrumentation more seamless.

To run as a full reverse proxy, you have to deploy your worker using [Routes](https://developers.cloudflare.com/workers/platform/triggers/routes/). Follow these instructions to setup your worker:

✋ As a pre-requisit, you need to sign-up for a Cloudflare account, and add your domain to Cloudflare so that Cloudflare is able to resolve your domain. Use [these instructions](<https://developers.cloudflare.com/learning-paths/get-started/#domain-resolution-(active-website)>) to setup your website with Cloudflare.

1- Follow the [Get Started Guide](https://developers.cloudflare.com/workers/get-started/guide/) to setup a basic Cloudflare worker using Wrangler, and by choosing the default options offered by Wrangler during the setup. After the setup, you should have a directory, with a "Hello World" worker setup.

2- Install the Segment Edge SDK in your worker project

```
yarn add @segment/edge-sdk
or
npm install @segment/edge-sdk
```

3- Update your worker code (`index.ts`) as follows:

```diff
+ import { Segment } from "@segment/edge-sdk";

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

🎉 Now if you visit your website, all the pages are automatically instrumented with analytics.js!

### Running on a dedicated sub-domain

This approach runs the worker on a sub-domain of yours, and the worker will only be responsible for first-party delivery of AJS, and delivering client-side traits. But the worker will not intercept individual pages on your main domain, and therefore features such as Personalization or Automatic AJS Injection won't be available.

To run the worker on a sub-domain, you can deploy your worker using these instructions:
1- Follow steps 1-3 from the previous section
2- Update `wrangler.toml` file so that the worker is setup on a sub-domain in your zone

```diff
name = '...'
main = "src/index.ts"

+ routes = [
+ 	{ pattern = "your_sub_domain.your_website.com", custom_domain = true, zone_name = "your_website.com" }
+ ]
```

3- Modify the worker code to turn-off full proxy features:

```diff
    const segment = new Segment(
      {
        writeKey: "YOUR_WRITE_KEY",
        routePrefix: "magic",
        personasSpaceId: "...", // optional
        personasToken: "...", // optional
      },
      {
+       ajsInjection: false,
+       edgeVariations: false,
+       proxyOrigin: false,
      }
    );

```

4- Since the automatic AJS injection is not available, you have to add Segment snippet to your website manually. Make sure to modify the standard snippet so it points to your first-party domain:

```diff
- t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";
+ t.src="https://your_sub_domain.your_website.com/<your_prefix>/ajs/<random_uuid>"
```

### (Optional) Configuring Edge Storage for Storing Profiles

You can setup Edge Storage to store profiles on Edge and use them for personalization or client-side traits feature. Follow these steps:

1- Setup Cloudflare KV for Profiles Database

- Setup a KV using [these instructions](https://developers.cloudflare.com/workers/wrangler/workers-kv/#create-a-kv-namespace-with-wrangler)
- Update your worker code as follows:

```diff
import { Segment } from "@segment/edge-sdk";

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

2- Setup Profiles Sync, using both or one of the sync approaches explained in the next couple of sections.

### Configure Profiles API Access

Edge SDK can query Twilio Segment Profiles API to look for those profiles missing from the KV. Make sure you setup both `personasSpaceId` and `personasToken` settings correctly during the SDK initialization for this feature to work.

### Configure Engage Incoming Webhook

You can also configure a webhook for Twilio Engage to call in order to sync user traits to the Edge database. Follow these steps for configure your webhook:

1- Initialize SDK with a webhook username and password

```diff
    const segment = new Segment(
      {
        writeKey: "YOUR_WRITE_KEY",
        routePrefix: "magic",
        personasSpaceId: "...", // optional
        personasToken: "...", // optional
        profilesStorage: env.MY_KV_NAMESPACE,
+       engageWebhookUsername: "" // choose a username
+       engageWebhookPassword: "" // choose a password
      }
    );
```

2- Goto your Segment workspace in `app.segment.com` and visit `Engage>Engage Settings` page
3- Click on "+ Add Destination"
4- Choose "Webhook" and connect it to your Personas source
5- In the destination settings configure your Webhook URL as the URL of your website that runs the Edge SDK with following format `https://your_first_party_url/<routePrefix>/personas` and then add a `Authorization` header with the value of `Basic <base64 encoded value of username:password>`.
6- Go to each of your Audiences that you like to sync with Edge, connect your webhook destination to the Audience, and make sure the destination is configured with "Send Identify".

🎉 You are all set. Twilio Engage will start syncing your audiences with your worker!

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

The SDK will automatically adds AJS snippet to the `<HEAD>` of each page.

👉 This feature should only be used if the SDK is being used as a full proxy of the origin.
👉 You can use `snippetPageSettings` when initializing the Edge SDK to control the initial page call for the injected snippet. For example:

```javascript
const segment = new Segment({
  writeKey: "...",
  routePrefix: "myPrefix",
  snippetPageSettings: false, // skips the initial page call in the snippet
});
```

### Server-side Cookies ( `features.serverSideCookies` )

The Edge SDK will set ajs_anonymous_id and ajs_user_id cookies as HTTPOnly. This feature has several benefits:

👉 It prevents Safari browsers from clearing those ids, as currently Safari limits the TTL of JS accessible storage to 7 days.
👉 It prevents client-side code from accessing those identifiers.
There are a few important considerations regarding the server-side cookies:

There are a few important considerations regarding the server-side cookies:

👉 Users visiting a website for the first time will receive an `anonymousId` that is generated on the Edge and stored as an HTTPOnly cookie.
👉 If a user is already identified on a given browser (has either an `anonymousId` or `userId`), the Edge SDK will respect those identities but convert them from client-side cookies to server-side cookies.

👉 If a user's identity is updated through a call to the `identify` / `track` / `page` / `group` methods, the identity is initially stored as a client-side cookie. When the browser receives the response from the Edge, the cookie is promoted to a server-side cookie.

👉 If a user's identity is updated through `analytics.setAnonymousId()` or ` analytics.user().id(``'``…') `, the identity is initially set as a client-side cookie. On the next request (either a tracking call or when AJS loads again), the cookie is promoted to an HTTPOnly cookie.

👉 If the identity of the user is cleared using `analytics.reset()`, the identity is initially cleared from the browser, and subsequently, browser notifies to worker to clear the server-side cookies.

### Redact writekeys ( `features.redactWritekey` )

The Edge SDK has the ability to remove the writeKey from AJS, Settings, and calls to the tracking API, and then add the writeKey to events from the Edge. This allows you to keep your writeKey private and not expose it on the browser. Note that writeKeys are typically public, but this feature gives you the option to keep it hidden on the browser.

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

The `features.engageIncomingWebhook` option enables a webhook that can be used by Twilio Engage to send audience data to the Cloudflare worker. This feature is useful for integrating the Edge SDK with Twilio Engage, allowing you to use audience information from Twilio Engage in your personalization and other features powered by the Edge SDK.

### Using Profiles API for identity resolution ( `features.useProfilesAPI` )

The SDK will use the Twilio Segment Profiles API, if the user profile is not available on the Edge. If turning on this feature, you should provide the Profiles API crendentials during the SDK initialization.

### Proxy Origin (`proxyOrigin`)

This feature will allow the SDK to proxy all the calls to the origin. You should only use this feature if running the SDK as a full proxy.
