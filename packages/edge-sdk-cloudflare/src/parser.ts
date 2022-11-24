import snippet from "@segment/snippet";
import { v4 as uuidv4 } from "uuid";
import { Handler } from "worktop";
import { HandlerFunction } from "./types";

class ElementHandler {
  host: string;
  writeKey: string;
  routePrefix: string;
  constructor(host: string, writeKey: string, routePrefix: string) {
    this.host = host;
    this.writeKey = writeKey;
    this.routePrefix = routePrefix;
  }

  element(element: Element) {
    const snip = snippet.min({
      host: `${this.host}/${this.routePrefix}`,
      apiKey: this.writeKey,
      ajsPath: `/ajs/${uuidv4()}`,
      useHostForBundles: true,
      page: {},
    });

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

export const enrichWithAJSNoWriteKey: HandlerFunction = async (
  request,
  response,
  context
) => {
  if (!response) {
    return Promise.reject("No response");
  }
  const {
    settings: { routePrefix },
  } = context;
  const host = request.headers.get("host") || "";

  return [
    request,
    new HTMLRewriter()
      .on("head", new ElementHandler(host, "REDACTED", routePrefix))
      .transform(response),
    context,
  ];
};
