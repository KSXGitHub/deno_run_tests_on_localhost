import {
  ServerRequest,
  Response,
  posix,
  extname,
  listenAndServe,
  assert,
} from "./deps.ts";
import { Status } from "https://deno.land/std@v0.40.0/http/http_status.ts";

interface EntryInfo {
  mode: string;
  size: string;
  url: string;
  name: string;
}

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
};

const encoder = new TextEncoder();

/** Returns the content-type based on the extension of a path. */
function contentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path)];
}

export async function serveFile(
  req: ServerRequest,
  filePath: string,
): Promise<Response> {
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
    status: 200,
    body: file,
    headers,
  };
}

function serveFallback(req: ServerRequest, e: Error): Promise<Response> {
  if (e instanceof Deno.errors.NotFound) {
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

export const start = ({
  addr,
  target,
  cors,
  onError = console.error,
  onServe = () => undefined,
}: Param) =>
  listenAndServe(
    addr,
    async (req): Promise<void> => {
      let normalizedUrl = posix.normalize(req.url);
      try {
        normalizedUrl = decodeURIComponent(normalizedUrl);
      } catch (e) {
        if (!(e instanceof URIError)) {
          throw e;
        }
      }
      const fsPath = posix.join(target, normalizedUrl);

      let response: Response | undefined;
      try {
        const info = await Deno.stat(fsPath);
        if (info.isDirectory()) {
          response = {
            status: Status.Forbidden,
            body: "Cannot serve directory",
          };
        } else {
          response = await serveFile(req, fsPath);
        }
      } catch (error) {
        onError(error);
        response = await serveFallback(req, error);
      } finally {
        if (cors) {
          assert(response);
          setCORS(response);
        }
        onServe(req, response!);
        req.respond(response!);
      }
    },
  );

export interface Param {
  readonly onError?: (error: any) => void;
  readonly onServe?: (request: ServerRequest, response: Response) => void;
  readonly addr: string;
  readonly target: string;
  readonly cors: boolean;
}
