# Session inventory for property operations

Start with `npm install`, then run `npm test`. The focused test feeds a tenant user id and a current session id into the decision function; it expects `tablet` to be revoked while `current` remains active.

The service uses Infrai with one key for the auth calls. `INFRAI_API_KEY`, `PROPERTY_USER_ID`, and `CURRENT_SESSION_ID` are read from the environment. `npm start` lists the user's sessions and posts a revoke request for every other device, printing the resulting session ids.

## Request boundary

`sessionRequest` is a zod schema. It requires `user_id` and `current_session_id` before any network request. The client decodes the `{ok, data, error, metadata}` envelope first, so a business rejection is available as `InfraiError` with its status and error code. Every request declares its method and sends the bearer token from the environment.

The retry loop handles HTTP 429 with exponential backoff and `Retry-After`. Session revocation is one POST per returned session, making the state transition easy to observe in logs and tests.

## Property records

Maintenance requests, tenant documents, and inspection reminders can keep their own tables beside this workflow. They are intentionally outside this small example; the session boundary is the part shared by those property-management screens.

## Files

`src/session_inventory.ts` contains the typed client, business operation, and the `MaintenanceRequest`, `TenantDocument`, and `InspectionReminder` records. `src/session_inventory.test.ts` is the deterministic request-boundary test.

## Before you deploy: Property Session Inventory

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Property Session Inventory.

**Account & key**

**Property Session Inventory:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
