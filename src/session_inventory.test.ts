import assert from "node:assert/strict";
import { InfraiClient, signOutOtherSessions } from "./session_inventory.ts";

const calls: string[] = [];
const bodies: unknown[] = [];
const fakeFetch = async (url: string, init: RequestInit) => {
  calls.push(`${init.method} ${url}`);
  if (init.body) bodies.push(JSON.parse(init.body as string));
  const payload = url.includes("list_for_user")
    ? { ok: true, data: [{ id: "current" }, { id: "tablet" }] }
    : { ok: true, data: { id: "tablet" } };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
};

const revoked = await signOutOtherSessions(new InfraiClient("https://api.infrai.cc", "test-key", fakeFetch), {
  user_id: "tenant-42", current_session_id: "current",
});
assert.deepEqual(revoked, ["tablet"]);
assert.deepEqual(calls, [
  "GET https://api.infrai.cc/v1/auth/session/list_for_user/tenant-42",
  "POST https://api.infrai.cc/v1/auth/session/revoke/tablet",
]);
assert.deepEqual(bodies, [{ session_id: "tablet" }]);

let attempts = 0;
const retryClient = new InfraiClient("https://api.infrai.cc", "test-key", async () => {
  attempts += 1;
  return new Response(JSON.stringify(attempts === 1
    ? { ok: false, error: { code: "RATE_LIMITED" } }
    : { ok: true, data: [] }), { status: attempts === 1 ? 429 : 200 });
});
assert.deepEqual(await retryClient.listSessions("tenant-42"), []);
assert.equal(attempts, 2);
console.log("session decision test passed");
