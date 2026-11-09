import test from "node:test";
import assert from "node:assert/strict";
import { resolveTurnstileSiteKey } from "../js/turnstile-config.js";

test("local development disables CAPTCHA for login and signup", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
    assert.equal(resolveTurnstileSiteKey("configured-key", { development: true, hostname }), "");
  }
});
test("production and non-loopback development preserve the configured CAPTCHA", () => {
  for (const hostname of ["localhost", "127.0.0.1", "nativa.example", "localhost.evil.example"]) {
    assert.equal(resolveTurnstileSiteKey("configured-key", { development: false, hostname }), "configured-key");
  }
  assert.equal(resolveTurnstileSiteKey("configured-key", { development: true, hostname: "nativa.example" }), "configured-key");
});
