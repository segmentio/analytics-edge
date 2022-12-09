import {
  appendAJSCustomConfiguration,
  handleAJS,
  handleBundles,
  handleSettings,
} from "../assetsProxy";
import {
  enrichResponseWithIdCookies,
  extractIdFromCookie,
  extractIdFromPayload,
} from "../cookies";
import { Router } from "../router";
import { Segment } from "../segment";
import { mockContext } from "./mocks";

const getResponseWithContext = async (context: Record<string, string>) =>
  (
    await enrichResponseWithIdCookies(
      new Request("https://doest-not-matter.com/"),
      new Response(JSON.stringify({}), { headers: {} }),
      {
        ...mockContext,
        host: "sushi-shop.com",
        ...context,
      }
    )
  )?.[1];

describe("cookies", () => {
  it("adds id cookies to the response", async () => {
    const resp = await getResponseWithContext({
      userId: "abc",
      anonymousId: "def",
    });

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_anonymous_id=def;");
    expect(cookie).toContain("ajs_user_id=abc;");
    expect(cookie).toContain("Domain=sushi-shop.com;");
    expect(cookie).toContain("HttpOnly");
  });

  it("use top domain for the cookie", async () => {
    const [req, resp, context] = await enrichResponseWithIdCookies(
      new Request("https://doest-not-matter.com/"),
      new Response(JSON.stringify({}), { headers: {} }),
      {
        ...mockContext,
        userId: "abc",
        host: "segment.sushi-shop.com",
      }
    );

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_user_id=abc;");
    expect(cookie).toContain("Domain=sushi-shop.com;");
    expect(cookie).toContain("HttpOnly");
  });

  it("generates anonymousId if it doesn't provided in the context", async () => {
    const resp = await getResponseWithContext({
      userId: "abc",
    });

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_anonymous_id="); // anonymousId is generated
    expect(cookie).toContain("ajs_user_id=abc;");
  });

  it("doesn't set userId if it is not provided in the context", async () => {
    const resp = await getResponseWithContext({
      anonymousId: "ghost",
    });

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_anonymous_id=ghost");
    expect(cookie).not.toContain("ajs_user_id");
  });

  it("extract id from requests with identity cookies", async () => {
    const request = new Request("https://doest-not-matter.com/", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=abc; ajs_anonymous_id=123",
      },
    });

    const resp = new Response();

    const [newRequest, newResponse, newContext] = await extractIdFromCookie(
      request,
      resp,
      mockContext
    );

    expect(newContext.anonymousId).toBe("123");
    expect(newContext.userId).toBe("abc");
    expect(newRequest).toBe(request);
    expect(newResponse).toBe(resp);
  });

  it("extract id from requests that has identity in them", async () => {
    const payload = {
      anonymousId: "123",
      userId: "abc",
      type: "track",
      event: "test",
    };
    const request = new Request("https://doest-not-matter.com/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const [newRequest, newResponse, newContext] = await extractIdFromPayload(
      request,
      new Response(),
      mockContext
    );

    expect(newContext.anonymousId).toBe("123");
    expect(newContext.userId).toBe("abc");

    const outputJson = await newRequest.json();
    expect(outputJson).toEqual(payload); // doesn't modify the payload
  });
});
