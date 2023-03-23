import snippet from "@segment/snippet";
import { v4 as uuidv4 } from "uuid";
import { Handler } from "worktop";
import { EdgeSDKSettings, HandlerFunction } from "./types";

class ElementHandler {
  host: string;
  writeKey: string;
  routePrefix: string;
  snippetInitialPageView: boolean;
  constructor(
    host: string,
    writeKey: string,
    routePrefix: string,
    snippetInitialPageView: boolean = true
  ) {
    this.host = host;
    this.writeKey = writeKey;
    this.routePrefix = routePrefix;
    this.snippetInitialPageView = snippetInitialPageView;
  }

  element(element: Element) {
    const snip = snippet.min({
      host: `${this.host}/${this.routePrefix}`,
      apiKey: this.writeKey,
      ajsPath: `/ajs/${uuidv4()}`,
      useHostForBundles: true,
      page: this.snippetInitialPageView ? {} : false,
    });

    element.append(`<script>${snip}</script>`, { html: true });
  }
}

export const enrichWithAJS: HandlerFunction = async (
  request,
  response,
  context
) => {
  const {
    settings: { writeKey, routePrefix, snippetInitialPageView },
  } = context;
  const host = context.host;

  return [
    request,
    new HTMLRewriter()
      .on(
        "head",
        new ElementHandler(host, writeKey, routePrefix, snippetInitialPageView)
      )
      .transform(response),
    context,
  ];
};

export const enrichWithAJSNoWriteKey: HandlerFunction = async (
  request,
  response,
  context
) => {
  const {
    settings: { routePrefix, snippetInitialPageView },
  } = context;
  const host = context.host;

  return [
    request,
    new HTMLRewriter()
      .on(
        "head",
        new ElementHandler(
          host,
          "REDACTED",
          routePrefix,
          snippetInitialPageView
        )
      )
      .transform(response),
    context,
  ];
};
