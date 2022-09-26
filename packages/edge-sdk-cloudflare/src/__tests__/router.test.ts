import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";

describe("router", () => {
  const router = new Router("seg", {} as Env, {} as Segment);
  const handler = jest
    .fn()
    .mockImplementation(() => Promise.resolve([{}, {}, {}]));

  beforeAll(() => {
    const routes = [
      "ajs",
      "settings",
      "bundles",
      "destinations",
      "tapi",
      "root",
    ];
    routes.forEach((route) => {
      router.register(route, (a, b, c) => handler(a, b, { ...c, route }));
    });
  });

  afterEach(() => {
    handler.mockClear();
  });

  it("Proxy settings", () => {
    const request = new Request("https://😬.com/seg/v1/projects/abc/settings");
    router.handle(request);

    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      params: {
        writeKey: "abc",
      },
      route: "settings",
    });
  });

  it("Proxy bundles and grabs the bundle name", () => {
    const request = new Request(
      "https://👻.com/seg/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
    );
    router.handle(request);

    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      params: {
        bundleName: "schemaFilter.bundle.debb169c1abb431faaa6.js",
      },
      route: "bundles",
    });
  });

  it("Proxy destinations", () => {
    const request = new Request(
      "https://👀.com/seg/next-integrations/actions/braze/ha$hed.js"
    );
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      route: "destinations",
    });
  });

  it("Proxy tracking API", () => {
    const request = new Request("https://👣.com/seg/evs/t", {
      method: "POST",
    });
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      route: "tapi",
      params: {
        method: "t",
      },
    });
  });

  it("Proxy AJS", () => {
    const request = new Request("https://🚀.com/seg/ajs/r0tpUjybtJJxOT82lV62a");
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      route: "ajs",
      params: {
        hash: "r0tpUjybtJJxOT82lV62a",
      },
    });
  });

  it("Proxy pages", () => {
    let request = new Request("https://🍣.com/sashimi/salmon");
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      route: "root",
    });

    request = new Request(
      "https://🍣.com/sashimi/salmon/sashimi_side_shot.jpg"
    );
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
      route: "root",
    });
  });
});
