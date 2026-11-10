import { createRoomGameHandler } from "./handler.js";
Deno.serve(createRoomGameHandler({env:name=>Deno.env.get(name)}));
