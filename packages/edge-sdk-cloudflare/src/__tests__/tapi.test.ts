import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { Router } from "../router";
import { Segment } from "../segment";
import { handleTAPI } from "../tapi";
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

  it("Proxies TAPI", async () => {
    const request = new Request("https://customer.com/seg/v1/p", {
      method: "POST",
      body: JSON.stringify({ type: "page" }),
    });
    const [req, resp, context] = await handleTAPI(request, undefined, {
      ...mockContext,
    });
    expect(globalThis.fetch).toBeCalledWith(
      "https://api.segment.io/v1/p",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "page" }),
      })
    );
    expect(resp?.status).toBe(200);
  });
});
