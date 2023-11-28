import { createServer } from 'http';

export interface MockOriginServerProps {
  port: number;
}

export class MockOriginServer {
  private port: number;
  private server: ReturnType<typeof createServer>;

  constructor({port}: MockOriginServerProps) {
    this.port = port;
    this.server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${this.port}`);
      const path = url.pathname;

      if (!['get', 'options'].includes(req.method!.toLowerCase())) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Cannot ${req.method!} - Invalid method.`);
        return;
      }

      const pathData = pathMatcher(path);
      if (pathData.type === 'index') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(wrapInHTML("Hello from the customer origin!"));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(wrapInHTML(`Unknown origin resource.`));
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
  { type: 'index' } |
  {type: 'unknown'};

function pathMatcher(path: string): PathMatcherOutput {
  if (path === '/') {
    return { type: 'index' };
  }

  return { type: 'unknown' };
}

const wrapInHTML = (content: string) => `<!doctype html>
<html lang=en>
  <head>
    <meta charset=utf-8>
  </head>
  <body>
    ${content}
  </body>
</html>`;