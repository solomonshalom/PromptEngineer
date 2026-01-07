import { init } from "@instantdb/react";
import schema from "../instant.schema";

// Initialize InstantDB client with schema for type safety
// The APP_ID should be set in environment variables
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;

if (!APP_ID) {
  console.warn(
    "NEXT_PUBLIC_INSTANT_APP_ID is not set. InstantDB features will not work."
  );
}

export const db = init({
  appId: APP_ID || "",
  schema,
  // Enable first-party cookie auth for server-side user verification
  // This syncs auth state with the /api/instant route handler
  firstPartyPath: "/api/instant",
});

// Re-export types for convenience
export type { AppSchema } from "../instant.schema";

// Export the id function for creating new records
export { id } from "@instantdb/react";
