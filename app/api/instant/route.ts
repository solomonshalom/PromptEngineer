import { createInstantRouteHandler } from "@instantdb/react/nextjs";

/**
 * InstantDB Route Handler for Cookie-Based Auth Syncing
 *
 * This enables server components and server actions to access
 * the authenticated user via getUserOnServer().
 *
 * Required for server-side authentication verification.
 */
export const { POST } = createInstantRouteHandler({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
});
