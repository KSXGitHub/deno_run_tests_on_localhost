import {
  DeepFunc,
  traverseFileSystem,
} from "https://deno.land/x/tree@0.1.1/async.ts";
import {
  join,
} from "./deps.ts";

const TEST_FILE_REGEX = /\.test\.(ts|js)$/i;
const isTestFile = (filename: string) => TEST_FILE_REGEX.test(filename);

const DEEP_IGNORE = [".git", "node_modules"];
const deep: DeepFunc = (param) => !DEEP_IGNORE.includes(param.info.name!);

export async function getDefaultList(hostname: string, port: number) {
  const testFiles: string[] = [];
  for await (const item of traverseFileSystem(".", deep)) {
    const filename = join(item.container, item.info.name!);
    if (!isTestFile(filename)) continue;
    testFiles.push(`http://${hostname}:${port}/${filename}`);
  }
  return testFiles;
}

export default getDefaultList;
