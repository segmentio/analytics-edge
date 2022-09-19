import { Env } from "./types";

export async function handleSourceFunction(request: Request, env: Env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const method = parts.pop();

  let user_worker = env.dispatcher.get(method);
  console.log(user_worker);
  const data = await user_worker.fetch(request);

  const body = await data.json();
  return new Response(JSON.stringify(body));
}
