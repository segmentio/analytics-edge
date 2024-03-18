export type FetchParameters = Parameters<typeof fetch>

export type FetchInit = FetchParameters[1] & FastlyRequestOptions | undefined

export type FastlyRequestOptions = {
  backend?: string;
  fastly?: {
    decompressGzip?: boolean;
  }
}

export interface FetchSettings {
  fastly?: {
    backend?: string
  }
}

export async function fetchWithSettings(request: FetchParameters[0], init: FetchInit = {}, settings: FetchSettings) {
  const modifiedInit = modifyAccepts(request, init);
  modifiedInit.fastly = { decompressGzip: true };

  if (settings.fastly?.backend) {
    modifiedInit.backend = settings.fastly.backend
  }
 //TODO: change content encoding?
  return fetch(request, modifiedInit)
}

function modifyAccepts(request: FetchParameters[0], init: FetchInit): FetchInit & {} {
  let modifiedInit = init || {};
  let existingHeaders = init?.headers;
  if (!existingHeaders && typeof request !== 'string') {
    existingHeaders = request.headers;
  }

  if (!existingHeaders) {
    return modifiedInit;
  }

  const modifiedHeaders = cloneHeaders(existingHeaders);
  const acceptEncoding = modifiedHeaders.get('Accept-Encoding');
  if (acceptEncoding) {
    modifiedHeaders.set('Accept-Encoding', 'gzip');
  }

  // Cloudflare allows passing Request objects in initOptions
  // which has readonly headers, so we need to modify those headers
  // rather than replace.
  if (isRequest(modifiedInit)) {
    modifiedInit = new Request(modifiedInit, { headers: modifiedHeaders })
  } else {
    modifiedInit.headers = modifiedHeaders;
  } 
  
  return modifiedInit;
}

function cloneHeaders(headers: HeadersInit): Headers {
  const newHeaders = new Headers();
   if (!headers) {
    return newHeaders;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      newHeaders.append(key, value);
    });
  } else if (isHeaders(headers)) {
    for (const [key, value] of headers.entries()) {
      newHeaders.append(key, value);
    }
  } else if (typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      newHeaders.append(key, headers[key]);
    }
  }
  
  return newHeaders;
}

function isHeaders(headers: HeadersInit): headers is Headers {
  return 'entries' in headers;
}

function isRequest(request: FetchInit): request is Request {
  return Boolean(request && 'clone' in request);
}