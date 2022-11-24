import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext } from "./mocks";

describe("origin handlers", () => {
  beforeAll(() => {
    //@ts-ignore - getMiniflareFetchMock is global defined by miniflare
    const fetchMock = getMiniflareFetchMock();

    fetchMock.disableNetConnect();

    const origin = fetchMock.get("https://sushi-shop.com");
    origin
      .intercept({
        method: "GET",
        path: "/",
      })
      .reply(200, "Hello from Sushi Shop!");

    origin
      .intercept({
        method: "GET",
        path: "/menu",
      })
      .reply(200, "Sushi Menu!", { headers: { "content-type": "text/html" } });

    origin
      .intercept({
        method: "GET",
        path: "/logo.png",
      })
      .reply(200, "🎨", { headers: { "content-type": "image/png" } });
  });

  it("handleOrigin proxies requests to the origin", async () => {
    const request = new Request("https://sushi-shop.com/");
    const [req, resp, context] = await handleOrigin(
      request,
      undefined,
      mockContext
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toBe("Hello from Sushi Shop!");
  });

  it("handleOrigin does not fetch origin if there is already a response passed into the handler", async () => {
    const request = new Request("https://sushi-shop.com/");
    const response = new Response("Hello from the previous handler!");
    const [req, resp, context] = await handleOrigin(
      request,
      response,
      mockContext
    );

    expect(response).toBe(resp);
  });

  it("handleOriginWithEarlyExit don't fetch the origin if an experiment is setup on the route", async () => {
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

    let [req, resp, ctx] = await handleOriginWithEarlyExit(
      new Request("https://sushi-shop.com/"),
      undefined,
      context
    );
    expect(resp).toBeUndefined();
    expect(ctx.earlyExit).toBeFalsy();

    [req, resp, ctx] = await handleOriginWithEarlyExit(
      new Request("https://sushi-shop.com/menu"),
      undefined,
      context
    );
    expect(resp).toBeDefined();
    expect(await resp?.text()).toBe("Sushi Menu!");
    expect(ctx.earlyExit).toBeFalsy();
  });

  it("handleOriginWithEarlyExit does an early exist for non text/html content", async () => {
    let [req, resp, ctx] = await handleOriginWithEarlyExit(
      new Request("https://sushi-shop.com/logo.png"),
      undefined,
      mockContext
    );

    expect(resp).toBeDefined();
    expect(await resp?.text()).toBe("🎨");
    expect(ctx.earlyExit).toBeTruthy();
  });
});
