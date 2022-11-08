import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";
import { mockContext } from "./mocks";

describe("origin handler", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/html",
        }),
      });
    });
  });

  afterEach(() => {
    //@ts-ignore
    globalThis.fetch.mockClear();
  });

  it("Proxies requests to the origin", async () => {
    const request = new Request("https://originhandler.com/");
    const [req, resp, context] = await handleOrigin(
      new Request("https://originhandler.com/"),
      undefined,
      { ...mockContext }
    );
    expect(globalThis.fetch).toBeCalledWith(request);
    expect(resp?.status).toBe(200);
  });

  it("Don't fetch the origin if an experiment is setup on the route", async () => {
    const context = {
      ...mockContext,
      variations: [
        {
          route: "/",
          evaluationFunction: (audiences = {} as any) =>
            audiences.red ? "/red" : "/blue",
        },
      ],
    };

    let [req, resp] = await handleOriginWithEarlyExit(
      new Request("https://originhandler.com/"),
      undefined,
      context
    );
    expect(globalThis.fetch).not.toBeCalled();

    [req, resp] = await handleOriginWithEarlyExit(
      new Request("https://originhandler.com/test"),
      undefined,
      context
    );
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("Does early exist for non text/html content", async () => {
    let [req, resp, context] = await handleOriginWithEarlyExit(
      new Request("https://originhandler.com/"),
      undefined,
      mockContext
    );
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(context.earlyExit).toBe(undefined);

    // return a different content-type
    globalThis.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "image/png",
        }),
      });
    });
    [req, resp, context] = await handleOriginWithEarlyExit(
      new Request("https://originhandler.com/"),
      undefined,
      mockContext
    );
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(context.earlyExit).toBe(true);
  });
});
