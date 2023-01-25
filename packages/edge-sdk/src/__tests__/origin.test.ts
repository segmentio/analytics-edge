import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext, mockSushiShop } from "./mocks";

describe("origin handlers", () => {
  beforeAll(() => {
    mockSushiShop();
  });

  it("handleOrigin proxies requests to the origin", async () => {
    const request = new Request("https://sushi-shop.com/");
    const [req, resp, context] = await handleOrigin(
      request,
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );
    expect(resp?.status).toBe(200);
    expect(await resp?.text()).toContain("Hello from Sushi Shop 🍣");
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
      new Response("Unhandled Rejection", { status: 501 }),
      context
    );
    expect(resp.status).toBe(501);
    expect(ctx.earlyExit).toBeFalsy();

    [req, resp, ctx] = await handleOriginWithEarlyExit(
      new Request("https://sushi-shop.com/menu"),
      new Response("Unhandled Rejection", { status: 501 }),
      context
    );
    expect(resp).toBeDefined();
    expect(await resp?.text()).toContain("Sushi Menu!");
    expect(ctx.earlyExit).toBeFalsy();
  });

  it("handleOriginWithEarlyExit does an early exist for non text/html content", async () => {
    const [req, resp, ctx] = await handleOriginWithEarlyExit(
      new Request("https://sushi-shop.com/logo.png"),
      new Response("Unhandled Rejection", { status: 501 }),
      mockContext
    );

    expect(resp).toBeDefined();
    expect(await resp?.text()).toContain("🎨");
    expect(ctx.earlyExit).toBeTruthy();
  });
});
