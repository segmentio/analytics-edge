import snippet from "@segment/snippet";
import { nanoid } from "nanoid";

export default class ElementHandler {
  host: string;
  writeKey: string;
  basePath: string;
  anonymousId: string;
  traits: string;
  constructor(
    host: string,
    writeKey: string,
    basePath: string,
    anonymousId: string,
    traits: string
  ) {
    this.host = host;
    this.writeKey = writeKey;
    this.basePath = basePath;
    this.anonymousId = anonymousId;
    this.traits = traits;
  }

  element(element: Element) {
    const snip = snippet
      .max({
        host: `${this.host}/${this.basePath}`,
        apiKey: this.writeKey,
        ajsPath: `/ajs/${nanoid()}`,
        useHostForBundles: true,
        page: {},
      })
      .replace(
        `analytics.load("${this.writeKey}");`,
        `analytics.load("${this.writeKey}", {integrations: {
        "Segment.io": {apiHost: "${this.host}/${this.basePath}/evs"}}});analytics.setAnonymousId("${this.anonymousId}");analytics.identify(${this.traits})`
      );
    element.append(`<script>${snip}</script>`, { html: true });
  }
}
