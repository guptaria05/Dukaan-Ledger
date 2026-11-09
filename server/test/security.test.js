import test from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";

const { hashPassword, verifyPassword, tokenHash, newToken } = await import("../src/security.js");

test("password hashes are salted and verify only the original password", async () => {
  const first = await hashPassword("a-long-test-password");
  const second = await hashPassword("a-long-test-password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("a-long-test-password", first), true);
  assert.equal(await verifyPassword("incorrect-password", first), false);
});

test("session tokens are high entropy and stored as keyed digests", () => {
  const token = newToken();
  assert.ok(token.length >= 40);
  assert.equal(tokenHash(token), tokenHash(token));
  assert.notEqual(tokenHash(token), token);
});
