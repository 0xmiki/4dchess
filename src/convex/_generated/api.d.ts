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
import type * as clocks from "../clocks.js";
import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_clock_jobs from "../lib/clock_jobs.js";
import type * as lib_clocks from "../lib/clocks.js";
import type * as lib_invitations from "../lib/invitations.js";
import type * as lib_lifecycle from "../lib/lifecycle.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_online_availability from "../lib/online_availability.js";
import type * as lib_participants from "../lib/participants.js";
import type * as lib_validators from "../lib/validators.js";
import type * as matchmaking from "../matchmaking.js";
import type * as moves from "../moves.js";
import type * as operations from "../operations.js";
import type * as participants from "../participants.js";
import type * as watch from "../watch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abuse: typeof abuse;
  auth: typeof auth;
  clocks: typeof clocks;
  crons: typeof crons;
  games: typeof games;
  health: typeof health;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/clock_jobs": typeof lib_clock_jobs;
  "lib/clocks": typeof lib_clocks;
  "lib/invitations": typeof lib_invitations;
  "lib/lifecycle": typeof lib_lifecycle;
  "lib/limits": typeof lib_limits;
  "lib/online_availability": typeof lib_online_availability;
  "lib/participants": typeof lib_participants;
  "lib/validators": typeof lib_validators;
  matchmaking: typeof matchmaking;
  moves: typeof moves;
  operations: typeof operations;
  participants: typeof participants;
  watch: typeof watch;
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
