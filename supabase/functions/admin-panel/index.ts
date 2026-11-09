import { createAdminPanelHandler } from "./handler.js";

Deno.serve(createAdminPanelHandler({
  env: name => Deno.env.get(name),
}));
