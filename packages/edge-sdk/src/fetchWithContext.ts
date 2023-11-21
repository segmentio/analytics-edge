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
  const [modifiedRequest, modifiedInit] = modifyAccepts(request, init);

  if (settings.fastly?.backend) {
    modifiedInit.backend = settings.fastly.backend
  }
  modifiedInit.fastly = { decompressGzip: true }
 
  return fetch(modifiedRequest, modifiedInit)
}

function modifyAccepts(request: FetchParameters[0], init: FetchInit): [FetchParameters[0], FetchInit & {}] {
  let existingHeaders = init?.headers;
  if (!existingHeaders && typeof request !== 'string') {
    existingHeaders = request.headers;
  }
  
  const headers = new Headers(existingHeaders);
  const acceptEncoding = headers.get('Accept-Encoding');
  if (acceptEncoding) {
    headers.set('Accept-Encoding', 'gzip');
  }
  return [request, {...init, headers}];
}