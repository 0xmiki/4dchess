/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abuse from "../abuse.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_invitations from "../lib/invitations.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_participants from "../lib/participants.js";
import type * as lib_validators from "../lib/validators.js";
import type * as moves from "../moves.js";
import type * as operations from "../operations.js";
import type * as participants from "../participants.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abuse: typeof abuse;
  auth: typeof auth;
  crons: typeof crons;
  games: typeof games;
  health: typeof health;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/invitations": typeof lib_invitations;
  "lib/limits": typeof lib_limits;
  "lib/participants": typeof lib_participants;
  "lib/validators": typeof lib_validators;
  moves: typeof moves;
  operations: typeof operations;
  participants: typeof participants;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
