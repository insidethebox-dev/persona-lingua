// Jest setup file
process.env.NODE_ENV = "test";

// ---------------------------------------------------------------------------
// Live-database guard
//
// Several test files instantiate a real PrismaClient and call unscoped
// deleteMany() in their setup/teardown. Prisma Client auto-loads `.env` when
// DATABASE_URL is unset, so simply deleting the variable is NOT enough — the
// tests would silently connect to the live database and wipe it (this has
// happened before; see __tests__/database-schema.test.ts).
//
// Rule: database-backed tests run ONLY against TEST_DATABASE_URL, and that URL
// must be a local host or have "test" in the database name. Otherwise
// DATABASE_URL is pointed at an unreachable sentinel so any real connection
// attempt fails fast instead of touching production.
// ---------------------------------------------------------------------------
const BLOCKED_DATABASE_URL =
  "postgresql://blocked:blocked@127.0.0.1:1/no_test_database_configured?connect_timeout=1";

function looksLikeTestDatabase(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, "");
    const isLocal = host === "localhost" || host === "127.0.0.1";
    return isLocal || /test/i.test(dbName);
  } catch {
    return false;
  }
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  if (!looksLikeTestDatabase(testDatabaseUrl)) {
    throw new Error(
      "Refusing to run tests: TEST_DATABASE_URL must point at localhost/127.0.0.1 " +
        'or at a database whose name contains "test". Database tests wipe every table.'
    );
  }
  process.env.DATABASE_URL = testDatabaseUrl;
} else {
  process.env.DATABASE_URL = BLOCKED_DATABASE_URL;
}

// Mock NextAuth for testing
jest.mock("next-auth", () => ({
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

jest.mock("next-auth/next", () => ({
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

// Add global test timeout
jest.setTimeout(30000);
