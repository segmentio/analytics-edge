import { join as joinPath } from "path";
import { unstable_dev } from "wrangler";
import { Service } from '../service';

export async function startService(): Promise<Service> {
  const worker = await unstable_dev(joinPath(__dirname, "workers", "index.ts"), {
    experimental: { disableExperimentalWarning: true, },
    bundle: true,
    nodeCompat: false,
    config: joinPath(__dirname, "workers", "wrangler.test.toml"),
  });

  return {
    fetch: worker.fetch.bind(worker) as any as Service['fetch'],
    stop: worker.stop.bind(worker),
    edgeSdkSettings: {}
  }
}