import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";
import { mockContext } from "./mocks";

describe("router", () => {
  const router = new Router("seg", mockContext);
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
      ...mockContext,
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
      ...mockContext,
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
      ...mockContext,
      route: "destinations",
    });
  });

  it("Proxy tracking API", () => {
    const request = new Request("https://👣.com/seg/evs/t", {
      method: "POST",
    });
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      ...mockContext,
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
      ...mockContext,
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
      ...mockContext,
      route: "root",
    });

    request = new Request(
      "https://🍣.com/sashimi/salmon/sashimi_side_shot.jpg"
    );
    router.handle(request);
    expect(handler).toHaveBeenCalledWith(request, undefined, {
      ...mockContext,
      route: "root",
    });
  });

  it("Router runs the handlers in sequence", async () => {
    const handlerA = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve([{ url: "abc" }, { url: "abc" }, { data: "abc" }])
      );

    const handlerB = jest
      .fn()
      .mockImplementation(() => Promise.resolve([{}, {}, {}]));

    router.register("root", handlerA, handlerB);

    const request = new Request("https://🍣.com/sashimi/salmon");
    await router.handle(request);

    // output from default handler in beforeAll is {} {} {}
    expect(handlerA).toHaveBeenCalledWith({}, {}, {});

    expect(handlerB).toHaveBeenCalledWith(
      { url: "abc" },
      { url: "abc" },
      { data: "abc" }
    );
  });

  it("Router can do early exit", async () => {
    const handlerA = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve([{ url: "abc" }, { url: "abc" }, { earlyExit: true }])
      );

    const handlerB = jest
      .fn()
      .mockImplementation(() => Promise.resolve([{}, {}, {}]));

    router.register("root", handlerA, handlerB);

    const request = new Request("https://🍣.com/sashimi/salmon");
    await router.handle(request);

    expect(handlerA).toHaveBeenCalledWith({}, {}, {});

    expect(handlerB).not.toHaveBeenCalled();
  });

  it("Invalid routes", async () => {
    const request = new Request("https://🤦.com/api/get-sushi-ingredients", {
      method: "POST",
    });

    try {
      await router.handle(request);
    } catch (e) {
      expect(e).toBe("No handlers for route");
    }
  });
});
