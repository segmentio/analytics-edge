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
      new Request("https://doest-not-matter.com/", {
        headers: { host: "sushi-shop.com" },
      }),
      new Response(JSON.stringify({}), { headers: {} }),
      {
        ...mockContext,
        ...context,
      }
    )
  )?.[1];

describe("cookies", () => {
  it("enrichResponseWithIdCookies", async () => {
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

  it("generates anonymousId if it doesn't provided in the context", async () => {
    const resp = await getResponseWithContext({
      userId: "abc",
    });

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_anonymous_id=");
    expect(cookie).toContain("ajs_user_id=abc;");
  });

  it("doesn't set userId if it is not provided in the context", async () => {
    const resp = await getResponseWithContext({
      anonymousId: "def",
    });

    const cookie = resp?.headers.get("Set-Cookie");

    expect(cookie).toContain("ajs_anonymous_id=def");
    expect(cookie).not.toContain("ajs_user_id");
  });

  it("extract id from requests with identity cookies", async () => {
    const request = new Request("https://doest-not-matter.com/", {
      headers: {
        host: "sushi-shop.com",
        cookie: "ajs_user_id=abc; ajs_anonymous_id=123",
      },
    });

    const [newRequest, newResponse, newContext] = await extractIdFromCookie(
      request,
      new Response(),
      mockContext
    );

    expect(newContext.anonymousId).toBe("123");
    expect(newContext.userId).toBe("abc");
  });

  it("extract id from requests that has identity in them", async () => {
    const request = new Request("https://doest-not-matter.com/", {
      method: "POST",
      body: JSON.stringify({
        anonymousId: "123",
        userId: "abc",
        type: "track",
        event: "test",
      }),
    });

    const [newRequest, newResponse, newContext] = await extractIdFromPayload(
      request,
      new Response(),
      mockContext
    );

    expect(newContext.anonymousId).toBe("123");
    expect(newContext.userId).toBe("abc");
  });
});
