import { createServer, IncomingMessage } from 'http';

export interface EventPayload {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  event: Record<string, any>;
}

export type EventHandler = (event: EventPayload) => void;

export interface MockTrackingApiProps {
  port: number;
}

export class MockTrackingApi {
  private port: number;
  private server: ReturnType<typeof createServer>;
  private onEventHandlers: Set<EventHandler> = new Set();
  private validPaths: Set<string> = new Set(['/v1/a', '/v1/b', '/v1/g', '/v1/i', '/v1/m', '/v1/p', '/v1/s', '/v1/t'])

  constructor({ port }: MockTrackingApiProps) {
    this.port = port;
    this.server = createServer(async (req, res) => {
      const host = req.headers.host;
      const url = new URL(req.url!, `http://${host}`);
      const path = url.pathname;

      if (!this.validPaths.has(path)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
        return;
      }

      try {
        const payload = await getRequestText(req);
        const event = JSON.parse(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
        this.onEventHandlers.forEach((handler) => handler({ path, headers: req.headers, method: req.method!, event }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err }));
      }
    })
  }

  get host(): string {
    return `localhost:${this.port}`;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen({ port: this.port, host: 'localhost' }, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.onEventHandlers.clear();
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

  on(_event: 'event', handler: EventHandler) {
    this.onEventHandlers.add(handler);
  }

  off(_event: 'event', handler: EventHandler) {
    this.onEventHandlers.delete(handler);
  }
}

async function getRequestText(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const data: Buffer[] = []
    req.on('error', reject)
    req.on('data', (chunk) => {
      data.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(data).toString())
    })
  })
}