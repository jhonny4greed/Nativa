import { createGenerateArtHandler } from "./handler.js";

Deno.serve(createGenerateArtHandler({
  env: name => Deno.env.get(name),
}));
