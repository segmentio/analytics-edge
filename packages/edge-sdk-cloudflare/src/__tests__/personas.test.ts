import { handleOrigin, handleOriginWithEarlyExit } from "../origin";
import { extractProfileFromEdge, extractProfileFromSegment } from "../personas";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext } from "./mocks";

describe("personas handler", () => {
  beforeEach(() => {
    //@ts-ignore - getMiniflareFetchMock is global defined by miniflare
    const fetchMock = getMiniflareFetchMock();

    fetchMock.disableNetConnect();

    const origin = fetchMock.get("https://profiles.segment.com");
    origin
      .intercept({
        method: "GET",
        path: () => true,
      })
      .reply(
        200,
        {
          traits: {
            coolio: true,
          },
          cursor: {
            url: "",
            has_more: false,
            next: "",
            limit: 200,
          },
        },
        {
          headers: new Headers({
            "content-type": "json",
          }),
        }
      );
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

    expect(context?.traits).toEqual({ coolio: true });
    expect(mockContext.settings.profilesStorage.put).toBeCalledWith(
      "user_id:abc",
      JSON.stringify({ coolio: true }),
      { expirationTtl: 120 }
    );
  });
});
