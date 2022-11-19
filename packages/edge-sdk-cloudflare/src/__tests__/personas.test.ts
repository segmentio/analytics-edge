import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { extractProfileFromEdge, extractProfileFromSegment } from "../personas";
import { Router } from "../router";
import { Segment } from "../segment";
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
    const request = new Request("https://originhandler.com/");
    const audiences = { cool_people: true };
    jest
      .spyOn(mockContext.settings.profilesStorage, "get")
      .mockImplementationOnce(() => {
        return Promise.resolve(JSON.stringify(audiences));
      });

    const [req, resp, context] = await extractProfileFromEdge(
      request,
      undefined,
      { ...mockContext, userId: "1234" }
    );

    expect(context?.traits).toEqual(audiences);
  });

  it("extractProfileFromEdge return undefined object if identity is found", async () => {
    const request = new Request("https://originhandler.com/");
    const audiences = { cool_people: true };
    jest
      .spyOn(mockContext.settings.profilesStorage, "get")
      .mockImplementationOnce(() => {
        return Promise.resolve(JSON.stringify(audiences));
      });

    const [req, resp, context] = await extractProfileFromEdge(
      request,
      undefined,
      mockContext
    );

    expect(context?.traits).toBeUndefined();
  });

  it("handle profile queries personas profile ", async () => {
    const request = new Request("https://originhandler.com/");
    const audiences = { cool_people: true };
    jest
      .spyOn(mockContext.settings.profilesStorage, "put")
      .mockImplementationOnce(() => {
        return Promise.resolve(undefined);
      });

    const [req, resp, context] = await extractProfileFromSegment(
      request,
      undefined,
      { ...mockContext, userId: "abc" }
    );
    expect(globalThis.fetch).toBeCalledWith(
      "https://profiles.segment.com/v1/spaces/test/collections/users/profiles/user_id:abc/traits?limit=200&class=audience",
      expect.anything()
    );
    expect(context?.traits).toEqual({ coolio: true });
    expect(mockContext.settings.profilesStorage.put).toBeCalledWith(
      "user_id:abc",
      JSON.stringify({ coolio: true }),
      { expirationTtl: 120 }
    );
  });
});
