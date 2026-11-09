import { createAdminAssistantHandler } from "./handler.js";

Deno.serve(createAdminAssistantHandler({
  env: name => Deno.env.get(name),
}));
