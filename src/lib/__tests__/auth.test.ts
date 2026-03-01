import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { jwtVerify } from "jose";

// Mock server-only to allow testing
vi.mock("server-only", () => ({}));

// Mock next/headers
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockSet,
      get: mockGet,
      delete: mockDelete,
    })
  ),
}));

// Import after mocking
const { createSession, getSession, deleteSession } = await import("../auth");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a session with valid userId and email", async () => {
    const userId = "user-123";
    const email = "test@example.com";
    const now = new Date("2024-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    await createSession(userId, email);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [cookieName, token, options] = mockSet.mock.calls[0];

    expect(cookieName).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    expect(options).toMatchObject({
      httpOnly: true,
      secure: false, // NODE_ENV is not 'production' in tests
      sameSite: "lax",
      path: "/",
    });

    // Expiration should be 7 days from now
    const expectedExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(options.expires).toEqual(expectedExpiry);
  });

  it("creates a JWT token with correct payload", async () => {
    const userId = "user-456";
    const email = "admin@example.com";
    const now = new Date("2024-06-15T12:00:00.000Z");
    vi.setSystemTime(now);

    await createSession(userId, email);

    const [, token] = mockSet.mock.calls[0];

    // Verify the token can be decoded
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "development-secret-key"
    );
    const { payload } = await jwtVerify(token, secret);

    expect(payload.userId).toBe(userId);
    expect(payload.email).toBe(email);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
  });

  it("sets secure cookie in production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await createSession("user-789", "prod@example.com");

      const [, , options] = mockSet.mock.calls[0];
      expect(options.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("handles empty string userId", async () => {
    await createSession("", "test@example.com");

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [, token] = mockSet.mock.calls[0];

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "development-secret-key"
    );
    const { payload } = await jwtVerify(token, secret);

    expect(payload.userId).toBe("");
  });

  it("handles special characters in email", async () => {
    const specialEmail = "test+tag@example.co.uk";

    await createSession("user-123", specialEmail);

    const [, token] = mockSet.mock.calls[0];

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "development-secret-key"
    );
    const { payload } = await jwtVerify(token, secret);

    expect(payload.email).toBe(specialEmail);
  });

  it("creates tokens with consistent expiration times", async () => {
    const now = new Date("2024-03-01T10:30:00.000Z");
    vi.setSystemTime(now);

    await createSession("user-1", "user1@example.com");
    await createSession("user-2", "user2@example.com");

    const [, , options1] = mockSet.mock.calls[0];
    const [, , options2] = mockSet.mock.calls[1];

    expect(options1.expires).toEqual(options2.expires);
  });

  it("uses custom JWT_SECRET from environment", async () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "custom-test-secret-key";

    try {
      await createSession("user-999", "custom@example.com");

      const [, token] = mockSet.mock.calls[0];

      // Should be able to verify with custom secret
      const customSecret = new TextEncoder().encode("custom-test-secret-key");
      const { payload } = await jwtVerify(token, customSecret);

      expect(payload.userId).toBe("user-999");
      expect(payload.email).toBe("custom@example.com");
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("sets cookie with httpOnly flag to prevent XSS", async () => {
    await createSession("user-security", "security@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
  });

  it("sets cookie with sameSite=lax to prevent CSRF", async () => {
    await createSession("user-csrf", "csrf@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.sameSite).toBe("lax");
  });

  it("sets cookie path to root", async () => {
    await createSession("user-path", "path@example.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.path).toBe("/");
  });

  it("creates different tokens for different users", async () => {
    await createSession("user-1", "user1@example.com");
    await createSession("user-2", "user2@example.com");

    const [, token1] = mockSet.mock.calls[0];
    const [, token2] = mockSet.mock.calls[1];

    expect(token1).not.toBe(token2);
  });

  it("creates valid JWT with HS256 algorithm", async () => {
    await createSession("user-alg", "alg@example.com");

    const [, token] = mockSet.mock.calls[0];

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "development-secret-key"
    );
    const { protectedHeader } = await jwtVerify(token, secret);

    expect(protectedHeader.alg).toBe("HS256");
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session payload when valid token exists", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    // Create a session first to get a valid token
    await createSession(userId, email);
    const [, token] = mockSet.mock.calls[0];

    // Mock cookie retrieval
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).toBeDefined();
    expect(session?.userId).toBe(userId);
    expect(session?.email).toBe(email);
  });

  it("returns null when no token exists", async () => {
    mockGet.mockReturnValue(undefined);

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    mockGet.mockReturnValue({ value: "invalid-token" });

    const session = await getSession();

    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the auth-token cookie", async () => {
    await deleteSession();

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith("auth-token");
  });
});
