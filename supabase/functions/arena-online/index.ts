import { createArenaHandler } from "./handler.js";
Deno.serve(createArenaHandler({env: name=>Deno.env.get(name)}));
