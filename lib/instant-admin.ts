import { init } from "@instantdb/admin";
import schema from "../instant.schema";

// Initialize InstantDB admin client for server-side operations
// The ADMIN_TOKEN should be kept secret and only used on the server
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN;

// Lazy initialization to avoid errors when env vars are not set
let _adminDb: ReturnType<typeof init<typeof schema>> | null = null;

export function getAdminDb() {
  if (_adminDb) return _adminDb;

  if (!APP_ID) {
    throw new Error(
      "NEXT_PUBLIC_INSTANT_APP_ID environment variable is not set."
    );
  }

  if (!ADMIN_TOKEN) {
    throw new Error("INSTANT_ADMIN_TOKEN environment variable is not set.");
  }

  _adminDb = init({
    appId: APP_ID,
    adminToken: ADMIN_TOKEN,
    schema,
  });

  return _adminDb;
}

// Export a proxy for convenient usage
export const adminDb = new Proxy({} as ReturnType<typeof init<typeof schema>>, {
  get(_, prop) {
    const database = getAdminDb();
    const value = (database as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    if (typeof value === "function") {
      return value.bind(database);
    }
    return value;
  },
});
