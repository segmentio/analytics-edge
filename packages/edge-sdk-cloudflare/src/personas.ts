import { getCookie } from "./cookies";
import { Env, HandlerFunction, Storage, UserIdentity } from "./types";

export async function extractProfile(
  request: Request,
  profilesStore: Storage,
  userIdentity: UserIdentity,
  personasSpaceId?: string,
  personasToken?: string
): Promise<{ [key: string]: any }> {
  const { anonymousId, userId } = userIdentity;
  console.log(
    "extracting profile",
    anonymousId,
    userId,
    personasSpaceId,
    profilesStore
  );
  const profile_index = userId
    ? `user_id:${userId}`
    : `anonymous_id:${anonymousId}`;

  const profileData = await profilesStore.get(profile_index);
  let profileObject = {};

  if (!profileData) {
    console.log("no profile data found");
    if (personasToken && personasSpaceId) {
      const data = await fetch(
        `https://profiles.segment.com/v1/spaces/${personasSpaceId}/collections/users/profiles/${profile_index}/traits?limit=200`,
        {
          method: "GET",
          headers: {
            Authorization: "Basic " + btoa(`${personasToken}:`),
          },
        }
      );
      console.log("got personas data", data);
      if (data.status === 200) {
        profileObject = await data.json();
        await profilesStore.put(profile_index, JSON.stringify(profileObject), {
          expirationTtl: 120,
        });
        console.log(`reading prfile from API ${profile_index}`);
      }
    }
  } else {
    profileObject = JSON.parse(profileData);
    console.log(`reading from cache ${profile_index}`);
  }
  return profileObject;
}

export async function handlePersonasWebhook(request: Request, env: Env) {
  let event: { [key: string]: any } = await request.json();

  if (event.type !== "identify") {
    return new Response("", { status: 200 });
  }

  const {
    userId,
    traits,
    context: { personas: personas },
  } = event;

  const profile_index = `${userId}`;

  const rawProfileData = await env.Profiles.get(profile_index);
  const profileData = rawProfileData ? JSON.parse(rawProfileData) : {};

  delete traits.user_id;
  const updatedProfile =
    personas.computation_class === "audience"
      ? {
          ...profileData,
          audiences: { ...(profileData.audiences || {}), ...traits },
        }
      : {
          ...profileData,
          traits: { ...(profileData.traits || {}), ...traits },
        };

  await env.Profiles.put(profile_index, JSON.stringify(updatedProfile));
  return new Response(`${personas.computation_class} updated`, {
    status: 200,
  });
}

export const handleProfile: HandlerFunction = async function (
  request,
  response,
  context
) {
  const profileObject = await extractProfile(
    request,
    context.env.Profiles,
    {
      userId: getCookie(request, "ajs_user_id"),
      anonymousId: getCookie(request, "ajs_anonymous_id"),
    },
    context.instance.personasSpaceId,
    context.instance.personasToken
  );

  const traits = profileObject?.traits;

  return [request, response, { ...context, traits }];
};

export const handleABTests: HandlerFunction = async function (
  request,
  response,
  context
) {
  const url = new URL(request.url);
  for (const {
    originalRoute,
    positiveRoute,
    negativeRoute,
    evaluationFunction,
  } of context.instance.experiments) {
    console.log("checking experiment", originalRoute);
    if (url.pathname === originalRoute) {
      const testResult = evaluationFunction(context.traits);
      console.log("experiment test result", testResult);
      if (testResult === true) {
        url.pathname = positiveRoute;
        return [
          new Request(url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }),
          response,
          context,
        ];
      } else if (testResult === false) {
        url.pathname = negativeRoute;

        return [
          new Request(url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }),
          response,
          context,
        ];
      }
    }
  }
  return [request, response, context];
};

export const handleClientSideTraits: HandlerFunction = async function (
  request,
  response,
  context
) {
  console.log("handling client side traits");
  const clientSideTraits = context.instance.traitsFunc(context.traits);
  return [request, response, { ...context, clientSideTraits }];
};
