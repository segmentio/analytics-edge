import { HandlerFunction } from "./types";

export const handleOrigin: HandlerFunction = async (request, response, ctx) => {
  const resp = await fetch(request);

  return [request, resp, ctx];
};
