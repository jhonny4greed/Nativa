import { createEpidemicSoundHandler } from "./handler.js";
Deno.serve(createEpidemicSoundHandler({env:name=>Deno.env.get(name)}));
