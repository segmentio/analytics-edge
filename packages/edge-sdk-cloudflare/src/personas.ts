import { getCookie } from "./cookies";
import { Logger } from "./logger";
import {
  Env,
  HandlerFunction,
  PersonasWebhookPayload,
  Storage,
  UserIdentity,
  UserProfile,
} from "./types";

const PROFILE_CACHE_TTL = 120; // 2 minutes

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

  // for now we only support fetching profiles by userId, in the future
  // we can expand to all externalIds supported by personas
  if (!userId) {
    return {};
  }

  const profile_index = `user_id:${userId}`;

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
      // for now we only query audiences, in the future we can expand to all traits
      const data = await fetch(
        `https://profiles.segment.com/v1/spaces/${personasSpaceId}/collections/users/profiles/${profile_index}/traits?limit=200&class=audience`,
        {
          method: "GET",
          headers: {
            Authorization: "Basic " + btoa(`${personasToken}:`),
          },
        }
      );

      if (data.status === 200) {
        const dataJson = (await data.json()) as {
          traits: { [key: string]: any };
        };
        profileObject = dataJson?.traits;

        await profilesStore.put(profile_index, JSON.stringify(profileObject), {
          expirationTtl: PROFILE_CACHE_TTL,
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

export const handlePersonasWebhook: HandlerFunction = async (
  request,
  response,
  context
) => {
  let event = (await request.json()) as PersonasWebhookPayload;

  if (event.type !== "identify") {
    context.logger.log("debug", "Ignoring incoming webhook, not an identify", {
      event,
    });
    return [request, new Response("", { status: 200 }), context];
  }

  const {
    userId,
    traits,
    context: { personas: personas },
  } = event;

  if (personas.computation_class !== "audience") {
    context.logger.log("debug", "Ignoring incoming webhook, not an audience", {
      event,
    });
    return [request, new Response("", { status: 200 }), context];
  }

  context.logger.log("debug", "Accepting incoming webhook", { event });
  const profile_index = `${userId}`;
  const rawProfileData = await context.env.Profiles.get(profile_index);
  const profileData: UserProfile = rawProfileData
    ? JSON.parse(rawProfileData)
    : {};

  const updatedProfile = {
    ...profileData,
    ...traits,
  };

  await context.env.Profiles.put(profile_index, JSON.stringify(updatedProfile));
  context.logger.log("debug", `${personas.computation_class} updated`);

  return [
    request,
    new Response(`${personas.computation_class} updated`, {
      status: 200,
    }),
    context,
  ];
};

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

  const traits = profileObject;

  return [request, response, { ...context, traits }];
};

export const handleVariations: HandlerFunction = async function (
  request,
  response,
  context
) {
  if (context.variations) {
    const url = new URL(request.url);
    for (const { route, evaluationFunction } of context.variations) {
      if (url.pathname === route) {
        const originPath = evaluationFunction(context.traits);

        context.logger.log("debug", "Evaluating experiment", {
          route,
          originPath,
        });

        if (originPath) {
          url.pathname = originPath;
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
