import { createServer } from 'http';

export interface MockCdnServerProps {
  port: number;
  validWriteKeys: string[];
}

export class MockCdnServer {
  private port: number;
  private server: ReturnType<typeof createServer>;
  private validWriteKeys: Set<string>;

  constructor({port, validWriteKeys}: MockCdnServerProps) {
    this.port = port;
    this.validWriteKeys = new Set(validWriteKeys);
    this.server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${this.port}`);
      const path = url.pathname;

      if (!['get', 'options'].includes(req.method!.toLowerCase())) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Cannot ${req.method!} - Invalid method.`);
        return;
      }

      const pathData = pathMatcher(path);
      if (pathData.type === 'ajs') {
        if (!this.validWriteKeys.has(pathData.writeKey)) {
          res.writeHead(404);
          res.end(`Cannot GET - Invalid path or write key provided.`);
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(`Analytics JS Code!`);
        return;
      } else if (pathData.type === 'settings') {
        if (!this.validWriteKeys.has(pathData.writeKey)) {
          res.writeHead(404);
          res.end(`Cannot GET - Invalid path or write key provided.`);
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          "integrations": {
            "Segment.io": {
              "apiKey": pathData.writeKey,
              "apiHost": "api.segment.io/v1"
            }
          },
          "metrics": {
            "sampleRate": 0.1,
            "host": "api.segment.io/v1"
          },
          "remotePlugins": []
        }));
        return;
      } else if (pathData.type === 'core-bundle') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(`Core bundle 👨🏻‍💻`);
        return;
      } else if (pathData.type === 'action-destination') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(`Action destination 💥`);
        return;
      } else if (pathData.type === 'legacy-destination') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(`Legacy destination 👴`);
        return;
      }

      res.writeHead(404);
      res.end(`Unknown CDN resource.`);
    });
  }

  get host(): string {
    return `localhost:${this.port}`;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen({port: this.port, host: 'localhost'}, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.closeAllConnections();
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

type PathMatcherOutput = 
  { type: 'ajs', writeKey: string } |
  { type: 'settings', writeKey: string } |
  { type: 'core-bundle', filename: string } |
  { type: 'action-destination', name: string, filename: string } |
  { type: 'legacy-destination', name: string, version: string, filename: string } |
  {type: 'unknown'};

function pathMatcher(path: string): PathMatcherOutput {
  const ajsMatch = path.match(/\/analytics.js\/v1\/(.*)\/analytics.min.js/);
  if (ajsMatch) {
    return { type: 'ajs', writeKey: ajsMatch[1] };
  }

  const settingsMatch = path.match(/\/v1\/projects\/(.*)\/settings/);
  if (settingsMatch) {
    return { type: 'settings', writeKey: settingsMatch[1] };
  }

  const coreBundleMatch = path.match(/\/analytics-next\/bundles\/(.*)\.js/);
  if (coreBundleMatch) {
    return { type: 'core-bundle', filename: coreBundleMatch[1] };
  }

  const actionDestinationMatch = path.match(/\/next-integrations\/actions\/(.*)\/(.*\.js)/);
  if (actionDestinationMatch) {
    return { type: 'action-destination', name: actionDestinationMatch[1], filename: actionDestinationMatch[2] };
  }

  const legacyDestinationMatch = path.match(/\/next-integrations\/integrations\/(.*)\/(.*)\/(.*\.js\.gz)/);
  if (legacyDestinationMatch) {
    return { type: 'legacy-destination', name: legacyDestinationMatch[1], version: legacyDestinationMatch[2], filename: legacyDestinationMatch[3] };
  }

  return { type: 'unknown' };
}