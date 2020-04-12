import {
  Server,
  ServerRequest,
  Response,
  Status,
  posix,
  extname,
  serve,
  assert,
} from "./deps.ts";

const MEDIA_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".js": "application/javascript",
  ".jsx": "text/jsx",
  ".gz": "application/gzip",
  ".wasm": "application/wasm",
};

const encoder = new TextEncoder();

/** Returns the content-type based on the extension of a path. */
function contentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path)];
}

async function serveFile(filePath: string): Promise<Response> {
  const [file, fileInfo] = await Promise.all(
    [Deno.open(filePath), Deno.stat(filePath)],
  );
  const headers = new Headers();
  headers.set("content-length", fileInfo.size.toString());
  const contentTypeValue = contentType(filePath);
  if (contentTypeValue) {
    headers.set("content-type", contentTypeValue);
  }
  return {
    status: Status.OK,
    body: file,
    headers,
  };
}

function serveFallback(error: Error): Promise<Response> {
  if (error instanceof Deno.errors.NotFound) {
    return Promise.resolve({
      status: 404,
      body: encoder.encode("Not found"),
    });
  } else {
    return Promise.resolve({
      status: 500,
      body: encoder.encode("Internal server error"),
    });
  }
}

function setCORS(res: Response): void {
  if (!res.headers) {
    res.headers = new Headers();
  }
  res.headers.append("access-control-allow-origin", "*");
  res.headers.append(
    "access-control-allow-headers",
    "Origin, X-Requested-With, Content-Type, Accept, Range",
  );
}

export class FileServer {
  readonly #param: Param;
  readonly #server: Server;
  #stop: boolean = false;

  constructor (param: Param) {
    this.#param = param;
    this.#server = serve(param.addr);
  }

  public async start() {
    for await (const req of this.#server) {
      if (this.#stop) break;

      let normalizedUrl = posix.normalize(req.url);
      try {
        normalizedUrl = decodeURIComponent(normalizedUrl);
      } catch (e) {
        if (!(e instanceof URIError)) {
          throw e;
        }
      }

      const fsPath = posix.join(this.#param.target, normalizedUrl);

      let response: Response | undefined;
      try {
        const info = await Deno.stat(fsPath);
        if (info.isDirectory()) {
          response = {
            status: Status.Forbidden,
            body: "Cannot serve directory",
          };
        } else {
          response = await serveFile(fsPath);
        }
      } catch (error) {
        this.#param.onError?.(error);
        response = await serveFallback(error);
      } finally {
        if (this.#param.cors) {
          assert(response);
          setCORS(response);
        }
        this.#param.onServe?.(req, response!);
        req.respond(response!);
      }
    }
  }

  public stop() {
    this.#stop = true;
  }
}

export interface Param {
  readonly onError?: (error: any) => void;
  readonly onServe?: (request: ServerRequest, response: Response) => void;
  readonly addr: string;
  readonly target: string;
  readonly cors: boolean;
}
