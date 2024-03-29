import { getCookie } from "./cookies";
import { Logger } from "./logger";
import {
  HandlerFunction,
  PersonasWebhookPayload,
  ProfileAPIPayload,
  Storage,
  UserIdentity,
  UserProfile,
  UserProfileIndex,
} from "./types";

const PROFILE_CACHE_TTL = 120; // 2 minutes

export const handlePersonasWebhook: HandlerFunction = async (
  request,
  response,
  context
) => {
  const headers = request.headers;
  const authorization = headers.get("Authorization");
  if (!authorization || !authorization.startsWith("Basic ")) {
    context.logger.log("debug", "Basic authentication required");
    return [
      request,
      new Response("Basic authentication required", { status: 401 }),
      context,
    ];
  }
  // extract username and password from the Authorization header
  const encoded = authorization.split(" ")[1];
  const decoded = atob(encoded);
  const [username, password] = decoded.split(":");
  if (
    !username ||
    !password ||
    username !== context.settings.engageWebhookUsername ||
    password !== context.settings.engageWebhookPassword
  ) {
    context.logger.log("debug", "Invalid basic authentication credentials");
    return [
      request,
      new Response("Invalid basic authentication credentials", { status: 401 }),
      context,
    ];
  }

  if (!context.settings.profilesStorage) {
    context.logger.log("debug", "Profiles storage is not available");
    return [
      request,
      new Response("Storage not available", { status: 403 }),
      context,
    ];
  }

  const event = (await request.json()) as PersonasWebhookPayload;

  if (event.type !== "identify") {
    context.logger.log("debug", "Ignoring incoming webhook, not an identify", {
      event,
    });
    return [
      request,
      new Response("Segment identify event not found.", { status: 403 }),
      context,
    ];
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
    return [request, new Response("Ok", { status: 200 }), context];
  }

  context.logger.log("debug", "Accepting incoming webhook", { event });
  const profile_index: UserProfileIndex = `user_id:${userId}`;
  const rawProfileData = await context.settings.profilesStorage.get(
    profile_index
  );
  const profileData: UserProfile = rawProfileData
    ? JSON.parse(rawProfileData)
    : {};

  const updatedProfile = {
    ...profileData,
    ...traits,
  };

  await context.settings.profilesStorage.put(
    profile_index,
    JSON.stringify(updatedProfile)
  );
  context.logger.log("debug", `${personas.computation_class} updated`);

  return [
    request,
    new Response(`${personas.computation_class} updated`, {
      status: 200,
    }),
    context,
  ];
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

export const extractProfileFromEdge: HandlerFunction = async function (
  request,
  response,
  context
) {
  const userId = context.userId;

  context.logger.log("debug", "Extracting user profile from edge storage", {
    userId,
  });

  // for now we only support fetching profiles by userId, in the future
  // we can expand to all externalIds supported by personas
  if (!userId || context.settings.profilesStorage === undefined) {
    return [request, response, context];
  }

  const profile_index: UserProfileIndex = `user_id:${userId}`;

  const profileData = await context.settings.profilesStorage.get(profile_index);
  if (profileData) {
    return [request, response, { ...context, traits: JSON.parse(profileData) }];
  }

  context.logger.log("debug", "Profile wasn't found on Edge", {
    userId,
  });

  return [request, response, context];
};

export const extractProfileFromSegment: HandlerFunction = async function (
  request,
  response,
  context
) {
  const {
    settings: { personasSpaceId, personasToken },
    userId,
  } = context;

  // ignore if traits are already in the context
  if (
    !userId ||
    !personasSpaceId ||
    !personasToken ||
    context.traits ||
    context.settings.profilesStorage === undefined
  ) {
    return [request, response, context];
  }

  context.logger.log("debug", "Extracting user profile from profiles API", {
    userId,
  });

  const profile_index: UserProfileIndex = `user_id:${userId}`;

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
      const profilesResponse = (await data.json()) as ProfileAPIPayload;
      const profileObject = profilesResponse?.traits;

      await context.settings.profilesStorage.put(
        profile_index,
        JSON.stringify(profileObject),
        {
          expirationTtl: PROFILE_CACHE_TTL,
        }
      );

      return [request, response, { ...context, traits: profileObject }];
    }
  } catch (e) {
    context.logger.log("error", "Error querying Profiles API", {
      userId,
      error: e,
    });
  }

  return [request, response, context];
};
