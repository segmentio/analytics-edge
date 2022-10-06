import { getCookie } from "./cookies";
import { Logger } from "./logger";
import { Env, HandlerFunction, Storage, UserIdentity } from "./types";

export async function extractProfile(
  request: Request,
  profilesStore: Storage,
  userIdentity: UserIdentity,
  personasSpaceId: string | undefined,
  personasToken: string | undefined,
  logger: Logger
): Promise<{ [key: string]: any }> {
  const { anonymousId, userId } = userIdentity;

  logger.log("debug", "Extracting user profile from edge storage", {
    anonymousId,
    userId,
  });

  const profile_index = userId
    ? `user_id:${userId}`
    : `anonymous_id:${anonymousId}`;

  const profileData = await profilesStore.get(profile_index);
  if (profileData) {
    return JSON.parse(profileData);
  }

  logger.log("debug", "Profile wasn't found on Edge", {
    anonymousId,
    userId,
  });
  let profileObject = {};

  if (personasToken && personasSpaceId) {
    logger.log("debug", "Querying Profiles API", {
      anonymousId,
      userId,
    });
    try {
      const data = await fetch(
        `https://profiles.segment.com/v1/spaces/${personasSpaceId}/collections/users/profiles/${profile_index}/traits?limit=200`,
        {
          method: "GET",
          headers: {
            Authorization: "Basic " + btoa(`${personasToken}:`),
          },
        }
      );

      if (data.status === 200) {
        profileObject = await data.json();
        await profilesStore.put(profile_index, JSON.stringify(profileObject), {
          expirationTtl: 120,
        });
      }
    } catch (e) {
      logger.log("error", "Error querying Profiles API", {
        anonymousId,
        userId,
        error: e,
      });
    }
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
    context.settings.personasSpaceId,
    context.settings.personasToken,
    context.logger
  );

  const traits = profileObject?.traits;

  return [request, response, { ...context, traits }];
};

export const handleExperiments: HandlerFunction = async function (
  request,
  response,
  context
) {
  if (context.experiments) {
    const url = new URL(request.url);
    for (const {
      originalRoute,
      positiveRoute,
      negativeRoute,
      evaluationFunction,
    } of context.experiments) {
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
  }
  return [request, response, context];
};

export const handleClientSideTraits: HandlerFunction = async function (
  request,
  response,
  context
) {
  if (context.traitsFunc) {
    const clientSideTraits = context.traitsFunc(context.traits);
    return [request, response, { ...context, clientSideTraits }];
  } else {
    return [request, response, context];
  }
};
