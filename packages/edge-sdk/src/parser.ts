import snippet from "@segment/snippet";
import { v4 as uuidv4 } from "uuid";
import { EdgeSDKSettings, HandlerFunction } from "./types";

export const enrichWithAJS: HandlerFunction = async (
  request,
  response,
  context
) => {
  const {
    settings: { writeKey, routePrefix, snippetInitialPageView },
  } = context;
  const host = context.host;

  let ajsSnippet = snippet.min({
    host: `${host}/${routePrefix}`,
    apiKey: writeKey,
    ajsPath: `/ajs/${uuidv4()}`,
    useHostForBundles: true,
    page: snippetInitialPageView ? {} : false,
  });
  
  if (context.settings.experimental?.protocol) {
    ajsSnippet = ajsSnippet.replace('https://', `${context.settings.experimental.protocol}://`)
  }

  return [
    request,
    transformHTML(response, `<script>${ajsSnippet}</script>`),
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
  
  let ajsSnippet = snippet.min({
    host: `${host}/${routePrefix}`,
    apiKey: 'REDACTED',
    ajsPath: `/ajs/${uuidv4()}`,
    useHostForBundles: true,
    page: snippetInitialPageView ? {} : false,
  });

  if (context.settings.experimental?.protocol) {
    ajsSnippet = ajsSnippet.replace('https://', `${context.settings.experimental.protocol}://`)
  }

  return [
    request,
    transformHTML(response, `<script>${ajsSnippet}</script>`),
    context,
  ];
};

function transformHTML(
  response: Response,
  content: string
): Response {
  if (typeof HTMLRewriter !== 'undefined') {
    // use HTMLRewriter
    return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(content, { html: true })
      }
    }).transform(response)
  } else {
    return getStreamingHTMLTransform(response, content)
  }
}

function getStreamingHTMLTransform(response: Response, content: string) {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  // TODO: Check if response body exists
  if (response.body && !response.bodyUsed) {
    let responseContents = '';
    const stream = new TransformStream({
      transform(chunk: Uint8Array, controller) {
        responseContents += textDecoder.decode(chunk, {stream: true });
      },
      flush(controller) {
        responseContents += textDecoder.decode(undefined, {stream: false });

        const newContents = responseContents.replace('</head>', `${content}</head>`);
        controller.enqueue(textEncoder.encode(newContents));
      }   
    });

    return new Response(response.body.pipeThrough(stream), {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  } else {
    console.log(`Something weird happened here for ${response.url}`)
  }

  return response;
}