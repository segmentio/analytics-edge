import { spawn } from 'node:child_process';
import { join as joinPath } from "node:path";
import { Service } from "../service";

export async function startService(): Promise<Service> {
  const abortController = new AbortController();
  const host = '127.0.0.1:3010';
  const fastly = spawn('fastly', ['compute', 'serve', '--addr', host, '--dir', joinPath(__dirname, 'service')], {
    signal: abortController.signal
  });

  let serverRunningResolver: () => void;
  const serverRunning = new Promise<void>((resolve) => {
    serverRunningResolver = resolve;
  });

  fastly.stderr.on('data', (data) => {
    // console.error(`stderr: ${data}`);
  });
  fastly.stdout.on('data', (data) => {
    if (data.toString().includes('Listening on http://127.0.0.1:3010')) {
      serverRunningResolver();
    }
    console.log(`stdout: ${data}`);
  });

  await serverRunning;

  return {
    fetch: (...args) => {
      if (typeof args[0] === 'string') {
        const url = new URL(args[0]);
        url.host = host;
        url.protocol = 'http';
        args[0] = url.toString();
      } else {
        const request = args[0];
        const url = new URL(request.url);
        url.host = host;
        url.protocol = 'http';
        args[0] = new Request(url.toString(), request);
      }
      return fetch(...args);
    },
    stop: () => {
      return new Promise((resolve, reject) => {
        fastly.on('close', resolve);
        fastly.kill();
      });
    },
    edgeSdkSettings: {
      fastly: {
        segmentCdnBackend: 'segment-cdn',
        segmentTrackingAPIBackend: 'tracking-api',
        websiteOriginBackend: 'origin'
      }
    }
  }
}

