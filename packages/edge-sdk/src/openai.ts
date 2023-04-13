import { EdgeSDKSettings, HandlerFunction } from "./types";

export const personalizeWithAI: HandlerFunction = async (
  request,
  response,
  context
) => {
  const {
    settings: { openai },
  } = context;
  const host = context.host;

  return [
    request,
    new HTMLRewriter()
      .on("[data-edge-ai='personalize']", new RewriteWithAI(openai, context))
      .on("[data-edge-ai='completion']", new CompleteWithAI(openai, context))
      .transform(response),
    context,
  ];
};

class RewriteWithAI {
  openai: any;
  context: any;
  constructor(openai: any, context: any) {
    this.openai = openai;
    this.context = context;
  }

  async text(text: Text) {
    const { userId, traits } = this.context;
    const content = text.text;

    // Don't personalize if we don't have enough information or the content is too short (i.e., misc html tags).
    if (!userId || !traits || !content || content.trim().length < 20) {
      return;
    }

    const traitsString = objectToSortedKVPair(traits);

    const cacheKey = await hashSHA256(`gpt_cache_${traitsString}_${content}`);
    console.log("see cacheKey to personalize", cacheKey);
    const response = await this.context.settings.profilesStorage.get(cacheKey);
    if (response) {
      console.log("see response", response);
      text.replace(response);
      return response;
    }

    const personalizedContent = await rewriteWithGPT35S(
      content,
      userId,
      traitsString,
      this.openai.OPENAI_API_KEY
    );
    console.log("see personalizedContent", personalizedContent);
    const cacheTTL = 60 * 60 * 24; // Cache for 24 hours
    this.context.settings.profilesStorage.put(cacheKey, personalizedContent);
    text.replace(personalizedContent);
  }
}

class CompleteWithAI {
  openai: any;
  context: any;
  constructor(openai: any, context: any) {
    this.openai = openai;
    this.context = context;
  }

  async text(text: Text) {
    const { userId, traits } = this.context; // Assume these are provided in the request context.
    const content = text.text;

    if (!userId || !traits || !content || content.trim().length < 20) {
      return text.replace("");
    }
    const traitsString = objectToSortedKVPair(traits);
    const cacheKey = await hashSHA256(`gpt_cache_${traitsString}_${content}`);
    const response = await this.context.settings.profilesStorage.get(cacheKey);
    if (response) {
      text.replace(response);
      return response;
    }

    const personalizedContent = await completeWithGPT35(
      content,
      userId,
      traitsString,
      this.openai.OPENAI_API_KEY
    );
    const finalContent = text.text + personalizedContent;
    const cacheTTL = 60 * 60 * 24; // Cache for 24 hours
    this.context.settings.profilesStorage.put(cacheKey, finalContent);
    text.replace(finalContent);
  }
}

async function rewriteWithGPT35S(
  originalText: string,
  user_id: string,
  traitsString: string,
  GPT_API_KEY: string
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 1.1,
      messages: [
        {
          role: "system",
          content: `Evaluate the prompt and personalize it for a user with these attributes: \n${traitsString}`,
        },
        {
          role: "user",
          content: originalText,
        },
      ],
    }),
  });

  const data = await response.json();
  const personalizedText = data.choices[0].message.content.trim();
  return personalizedText;
}

async function completeWithDavinci(
  originalText: string,
  user_id: string,
  traitsString: string,
  GPT_API_KEY: string
) {
  const prompt = `Given a set of user traits:\n${traitsString}\nComplete this sentence in a way that is personalized for the user. Don't say hi or repeat the user traits, be on point, brief and specific: \n${originalText}`;

  const response = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 30,
      temperature: 0.9,
    }),
  });

  const data = await response.json();
  const personalizedText = data.choices[0].text.trim();
  return personalizedText;
}

async function completeWithGPT35(
  originalText: string,
  user_id: string,
  traitsString: string,
  GPT_API_KEY: string
) {
  // convert traits json to a string of key value pairs separated by new lines

  const prompt = `Given these user traits:\n${traitsString}\n\nComplete the following sentence: \n${originalText}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  const personalizedText = data.choices[0].message.content.trim();
  return personalizedText;
}

// sha256 hash function
async function hashSHA256(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

interface KeyValuePair {
  key: string;
  value: any;
}

// Flatten an object to a list of key value pairs
function flattenObject(
  obj: Record<string, any>,
  prefix: string = ""
): KeyValuePair[] {
  const result: KeyValuePair[] = [];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix} ${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        result.push(...flattenObject(obj[key], newKey));
      } else {
        result.push({ key: newKey, value: obj[key] });
      }
    }
  }
  return result;
}

// Convert an object to a string of key value pairs sorted alphabetically by key
function objectToSortedKVPair(obj: Record<string, any>) {
  const result = flattenObject(obj);
  // Sort the result list alphabetically by key
  result.sort((a, b) => a.key.localeCompare(b.key));

  // Create an array of formatted strings and join them with '\n '
  const formattedString = result
    .map((pair) => `${pair.key}: ${pair.value}`)
    .join("\n");

  return formattedString;
}
