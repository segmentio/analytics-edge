import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";

describe("router", () => {
  it("Proxy settings", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("/seg/v1/projects/abc/settings")).toEqual({
      route: "settings",
      params: {
        writeKey: "abc",
      },
    });
  });

  it("Proxy bundles and grabs the bundle name", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(
      router.getRoute(
        "/seg/analytics-next/bundles/schemaFilter.bundle.debb169c1abb431faaa6.js"
      )
    ).toEqual({
      route: "bundles",
      params: {
        bundleName: "schemaFilter.bundle.debb169c1abb431faaa6.js",
      },
    });
  });

  it("Proxy destinations", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(
      router.getRoute("/seg/next-integrations/actions/braze/ha$hed.js")
    ).toEqual({
      route: "destinations",
    });
  });

  it("Proxy tracking API", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("/seg/evs/t")).toEqual({
      route: "tapi",
      params: {
        method: "t",
      },
    });
  });

  it("Proxy source functions", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("/seg/sf/mySuperFancyFunction")).toEqual({
      route: "source-function",
      params: {
        function: "mySuperFancyFunction",
      },
    });
  });

  it("Proxy personas", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("/seg/personas")).toEqual({
      route: "personas",
    });
  });

  it("Proxy other routes to root", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("index.html")).toEqual({
      route: "root",
    });
    expect(router.getRoute("/shop/products/fancyShoe")).toEqual({
      route: "root",
    });
    expect(router.getRoute("/logout")).toEqual({
      route: "root",
    });
  });

  it("Proxy AJS", () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    expect(router).toBeDefined();
    expect(router.getRoute("/seg/ajs/r0tpUjybtJJxOT82lV62a")).toEqual({
      route: "ajs",
      params: {
        hash: "r0tpUjybtJJxOT82lV62a",
      },
    });
  });

  it("testing handlers", async () => {
    const router = new Router("seg", {} as Env, {} as Segment);
    const request = {
      method: "GET",
      url: "https://www.segment.com/seg/ajs/r0tpUjybtJJxOT82lV62a",
    } as any;

    expect(router).toBeDefined();
    const handlerOne = jest
      .fn()
      .mockImplementation(() => Promise.resolve([{}, {}]));
    const handlerTwo = jest
      .fn()
      .mockImplementation(() => Promise.resolve([request, {}]));

    router.register("ajs", [handlerOne, handlerTwo]);
    await router.handle(request);
    expect(handlerOne).toHaveBeenCalledWith(request, undefined, {
      env: {},
      instance: {},
    });
    expect(handlerTwo).toHaveBeenCalledWith(request, {}, {});
  });
});
