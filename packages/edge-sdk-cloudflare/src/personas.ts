import { Env, Storage, UserIdentity } from "./types";

export async function extractProfile(
  request: Request,
  profilesStore: Storage,
  userIdentity: UserIdentity,
  personasSpaceId?: string,
  personasToken?: string
): Promise<{ [key: string]: any }> {
  const { anonymousId, userId } = userIdentity;

  const profile_index = userId
    ? `user_id:${userId}`
    : `anonymous_id:${anonymousId}`;

  const profileData = await profilesStore.get(profile_index);
  let profileObject = {};

  if (!profileData) {
    if (personasToken && personasSpaceId) {
      const data = await fetch(
        `https://profiles.segment.com/v1/spaces/${personasSpaceId}/collections/users/profiles/${profile_index}/traits`,
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
