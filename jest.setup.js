// Jest setup file
process.env.NODE_ENV = "test";

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
