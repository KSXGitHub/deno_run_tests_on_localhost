import { FileServer } from "./lib.ts";
const fileServer = new FileServer({
  addr: "0.0.0.0:4500",
  target: Deno.cwd(),
  cors: true,
  onServe(request) {
    console.log(`${request.method} ${request.url}`);
  }
});
await fileServer.start();
