import snippet from "@segment/snippet";
import { nanoid } from "nanoid";
import { Handler } from "worktop";
import { HandlerFunction } from "./types";

class ElementHandler {
  host: string;
  writeKey: string;
  routePrefix: string;
  constructor(host: string, writeKey: string, routePrefix: string) {
    this.host = host;
    this.writeKey = "REDACTED";
    this.routePrefix = routePrefix;
  }

  element(element: Element) {
    const snip = snippet
      .max({
        host: `${this.host}/${this.routePrefix}`,
        apiKey: this.writeKey,
        ajsPath: `/ajs/${nanoid()}`,
        useHostForBundles: true,
        page: {},
      })
      .replace(
        `analytics.load("${this.writeKey}");`,
        `analytics.load("${this.writeKey}", {
          integrations: {
            "Segment.io": {apiHost: "${this.host}/${this.routePrefix}/evs"}
          }
        });`
      );
    element.append(`<script>${snip}</script>`, { html: true });
  }
}

export const enrichWithAJS: HandlerFunction = async (
  request,
  response,
  context
) => {
  if (!response) {
    return Promise.reject("No response");
  }
  const {
    settings: { writeKey, routePrefix },
  } = context;
  const host = request.headers.get("host") || "";

  return [
    request,
    new HTMLRewriter()
      .on("head", new ElementHandler(host, writeKey, routePrefix))
      .transform(response),
    context,
  ];
};
