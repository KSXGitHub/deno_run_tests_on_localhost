import { start } from "./lib.ts";
await start({
  addr: "0.0.0.0:4500",
  target: Deno.cwd(),
  cors: true,
  onServe(request) {
    console.log(`${request.method} ${request.url}`);
  },
});
