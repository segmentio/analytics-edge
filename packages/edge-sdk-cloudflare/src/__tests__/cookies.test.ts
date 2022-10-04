import {
  enrichAssetWithAJSCalls,
  handleAJS,
  handleBundles,
  handleSettings,
} from "../assetsProxy";
import { enrichResponseWithIdCookies } from "../cookies";
import { Router } from "../router";
import { Segment } from "../segment";
import { Env } from "../types";
import { mockContext } from "./mocks";

const getResponseWithContext = async (context: Record<string, string>) =>
  (
    await enrichResponseWithIdCookies("sushi-shop.com")(
      new Request("https://doest-not-matter.com/"),
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
});
