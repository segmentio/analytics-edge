import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { handleProfile } from "../personas";
import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";
import { mockContext } from "./mocks";

describe("personas handler", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "json",
        }),
        json: async () =>
          Promise.resolve({
            traits: {
              coolio: true,
            },
            cursor: {
              url: "",
              has_more: false,
              next: "",
              limit: 200,
            },
          }),
      });
    });
  });

  afterEach(() => {
    //@ts-ignore
    globalThis.fetch.mockClear();
    jest.resetAllMocks();
  });

  it("handle profile gets traits from the KV", async () => {
    const request = new Request("https://originhandler.com/", {
      headers: { cookie: "ajs_user_id=abc" },
    });
    const audiences = { cool_people: true };
    jest.spyOn(mockContext.env.Profiles, "get").mockImplementationOnce(() => {
      return Promise.resolve(JSON.stringify(audiences));
    });

    const [req, resp, context] = await handleProfile(
      request,
      undefined,
      mockContext
    );

    expect(context?.traits).toEqual(audiences);
  });

  it("handle profile return empty traits object if no id cookie found", async () => {
    const request = new Request("https://originhandler.com/");
    const audiences = { cool_people: true };
    jest.spyOn(mockContext.env.Profiles, "get").mockImplementationOnce(() => {
      return Promise.resolve(JSON.stringify(audiences));
    });

    const [req, resp, context] = await handleProfile(
      request,
      undefined,
      mockContext
    );

    expect(context?.traits).toEqual({});
  });

  it("handle profile queries personas profile if data is not in KV and saves results in KV", async () => {
    const request = new Request("https://originhandler.com/", {
      headers: { cookie: "ajs_user_id=abc" },
    });
    const audiences = { cool_people: true };
    jest.spyOn(mockContext.env.Profiles, "put").mockImplementationOnce(() => {
      return Promise.resolve(undefined);
    });

    const [req, resp, context] = await handleProfile(
      request,
      undefined,
      mockContext
    );
    expect(globalThis.fetch).toBeCalledWith(
      "https://profiles.segment.com/v1/spaces/test/collections/users/profiles/user_id:abc/traits?limit=200&class=audience",
      expect.anything()
    );
    expect(context?.traits).toEqual({ coolio: true });
    expect(mockContext.env.Profiles.put).toBeCalledWith(
      "user_id:abc",
      JSON.stringify({ coolio: true }),
      { expirationTtl: 120 }
    );
  });
});
