export async function handleAJS(
  request: Request,
  writeKey: string,
  baseSegment: string = "cdn.segment.com"
): Promise<Response> {
  const url = `${baseSegment}/analytics.js/v1/${writeKey}/analytics.min.js`;
  const resp = await fetch(url);
  return resp;
}

export async function handleSettings(
  request: Request,
  writeKey: string,
  baseSegment: string = "cdn.segment.com"
): Promise<Response> {
  const url = `${baseSegment}/v1/projects/${writeKey}/settings`;
  const resp = await fetch(url);
  return resp;
}

export async function handleBundles(
  request: Request,
  basePath: string,
  baseSegment: string = "cdn.segment.com"
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(`/${basePath}/`, "/");
  const target = `${baseSegment}${path}`;
  const resp = await fetch(target);
  return resp;
}
