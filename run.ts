import {
  ServerRequest,
  Response,
  join,
} from "./deps.ts";
import {
  DeepFunc,
  traverseFileSystem,
} from "https://deno.land/x/tree@0.1.1/async.ts";
import {
  FileServer,
} from "./file-server.ts";

export interface Param {
  readonly deep?: DeepFunc;
  readonly isTestFile?: FilterFunc;
  readonly onServe?: (request: ServerRequest, response: Response) => void;
  readonly port: number;
  readonly hostname: string;
  readonly cors?: boolean;
  readonly deno?: string;
  readonly permissions?: readonly string[];
  readonly args?: readonly string[];
}

export interface FilterFunc {
  (filename: string): boolean;
}

const DEFAULT_TEST_FILE_REGEX = /\.test\.(ts|js)$/i;
export const DEFAULT_TEST_FILE_FILTER: FilterFunc = (filename) =>
  DEFAULT_TEST_FILE_REGEX.test(filename);

const TRAVERSE_IGNORE = [".git", "node_modules"];
export const DEFAULT_DEEP: DeepFunc = (param) =>
  !TRAVERSE_IGNORE.includes(param.info.name!);

export async function run(param: Param): Promise<Deno.ProcessStatus> {
  const {
    isTestFile = DEFAULT_TEST_FILE_FILTER,
    deep = DEFAULT_DEEP,
    deno = "deno",
    permissions = [],
    args = [],
    cors = false,
    hostname,
    port,
    onServe,
  } = param;

  const testFiles: string[] = [];
  for await (const item of traverseFileSystem(".", deep)) {
    const filename = join(item.container, item.info.name!);
    if (!isTestFile(filename)) continue;
    testFiles.push(`http://${hostname}:${port}/${filename}`);
  }

  if (!testFiles.length) {
    throw "No tests.";
  }

  const server = new FileServer({
    port,
    hostname,
    onServe,
    cors,
    target: ".",
  });

  return new Promise(async (resolve, reject) => {
    server.start().catch(reject);

    const cp = Deno.run({
      cmd: [
        deno,
        "test",
        `--reload=http://${hostname}:${port}`,
        `--allow-net=${hostname}:${port}`,
        ...permissions,
        ...testFiles,
        ...args,
      ],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    const status = await cp.status();
    server.stop();
    resolve(status);
  });
}

export default run;
