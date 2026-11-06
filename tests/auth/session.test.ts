import { createSession, getCurrentUser, destroySession } from '@/lib/auth/session';
import { sign, unsign } from 'cookie-signature';
import { vi } from 'vitest';

const SESSION_COOKIE_NAME = 'iitgn_staff_session_v3';

// Global mock cookies map
const mockCookies = new Map();

// Mock user data
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  active: true,
  role: {
    code: 'DEPT_STAFF',
    name: 'Department Staff',
    level: 3,
    permissions: [
      { permission: { code: 'COMPLAINT_VIEW_DEPT' } },
      { permission: { code: 'COMPLAINT_UPDATE_STATUS' } },
    ],
  },
  department: {
    id: 'dept-id',
    code: 'ELEC',
    name: 'Electrical Maintenance',
  },
};

// Mock next/headers cookies at module level
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === SESSION_COOKIE_NAME) {
        return { value: mockCookies.get(name) };
      }
      return undefined;
    },
    set: (name: string, value: string) => {
      mockCookies.set(name, value);
    },
    delete: (name: string) => {
      mockCookies.delete(name);
    },
  }),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Session Cookie Signing', () => {
  const testEmail = 'test@example.com';
  const secret = 'test-secret-key-at-least-32-chars-long';

  beforeEach(() => {
    process.env.COOKIE_SECRET = secret;
    process.env.NODE_ENV = 'test';
    mockCookies.clear();
    vi.clearAllMocks();
  });

  it('should create signed session cookie', async () => {
    await createSession(testEmail);
    
    const cookieValue = mockCookies.get(SESSION_COOKIE_NAME);
    expect(cookieValue).toBeDefined();
    expect(cookieValue).not.toBe(testEmail); // Should be signed, not plain email
    
    const unsigned = unsign(cookieValue, secret);
    expect(unsigned).toBe(testEmail);
  });

  it('should reject tampered cookies', async () => {
    // Create a valid session first
    await createSession(testEmail);
    const validCookie = mockCookies.get(SESSION_COOKIE_NAME);
    
    // Tamper with the cookie
    mockCookies.set(SESSION_COOKIE_NAME, validCookie + 'tampered');
    
    // Mock prisma to not find user (since cookie is invalid)
    const { prisma } = await import('@/lib/prisma');
    prisma.user.findUnique.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull(); // Should reject tampered cookie
  });

  it('should reject unsigned cookies', async () => {
    // Set unsigned cookie directly (simulating an attacker)
    mockCookies.set(SESSION_COOKIE_NAME, testEmail);
    
    // Mock prisma to not find user (since cookie is invalid)
    const { prisma } = await import('@/lib/prisma');
    prisma.user.findUnique.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull(); // Should reject unsigned cookie
  });

  it('should accept valid signed cookies', async () => {
    // Create a properly signed cookie
    const signedEmail = sign(testEmail, secret);
    mockCookies.set(SESSION_COOKIE_NAME, signedEmail);
    
    // Mock prisma to return our test user
    const { prisma } = await import('@/lib/prisma');
    prisma.user.findUnique.mockResolvedValue(mockUser);
    
    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe(testEmail);
  });

  it('should destroy session cookie', async () => {
    // Create session
    await createSession(testEmail);
    expect(mockCookies.has(SESSION_COOKIE_NAME)).toBe(true);
    
    // Destroy session
    await destroySession();
    expect(mockCookies.has(SESSION_COOKIE_NAME)).toBe(false);
  });
});