/**
 * Diagnostic utilities for debugging 401 errors in E2E tests
 *
 * Usage:
 *   import { log401Context, verifyJwtToken } from './support/debug-401';
 *
 *   const token = loginRes.body.accessToken;
 *   log401Context(token, staff);
 */

import * as jwt from 'jsonwebtoken';
import type { Staff } from '../../../src/staff/entities/staff.entity';

interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  status: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

/**
 * Logs all context needed for 401 debugging
 */
export function log401Context(token: string, staff?: Staff): void {
  console.log('\n=== 401 DEBUG CONTEXT ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('TZ:', process.env.TZ || 'not set');

  // JWT token details
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (decoded) {
      console.log('\n[JWT Decoded]');
      console.log('  sub (staffUid):', decoded.sub);
      console.log('  sid (staffId):', decoded.sid);
      console.log('  role:', decoded.role);
      console.log('  status:', decoded.status);
      console.log(
        '  iat:',
        decoded.iat,
        '→',
        decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'N/A',
      );
      console.log(
        '  exp:',
        decoded.exp,
        '→',
        decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'N/A',
      );
      console.log('  iss:', decoded.iss || 'not set');

      if (decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const remaining = decoded.exp - now;
        console.log('  remaining:', remaining, 'seconds');
        if (remaining <= 0) {
          console.log('  ⚠️  TOKEN EXPIRED');
        }
      }
    }
  } catch (error) {
    console.log('  ❌ Failed to decode JWT:', error);
  }

  // Authorization header format
  console.log('\n[Authorization Header]');
  console.log('  Format: Authorization: Bearer <token>');
  console.log('  Token length:', token.length);
  console.log('  Token prefix:', token.substring(0, 20) + '...');

  // Staff DB state
  if (staff) {
    console.log('\n[Staff DB State]');
    console.log('  staffUid:', staff.staffUid);
    console.log('  staffId:', staff.staffId);
    console.log('  status:', staff.status);
    console.log('  pinMustChange:', staff.pinMustChange);
    console.log('  emrPatientId:', staff.emrPatientId || 'null');
    console.log('  dateOfBirth:', staff.dateOfBirth || 'null');
    console.log('  sexCode:', staff.sexCode || 'null');
  }

  // Environment
  console.log('\n[Environment]');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '<set>' : '❌ NOT SET');
  console.log('  JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN);
  console.log('  DB_HOST:', process.env.DB_HOST);
  console.log('  DB_DATABASE:', process.env.DB_DATABASE);

  console.log('=== END DEBUG CONTEXT ===\n');
}

/**
 * Verifies JWT token with current secret
 */
export function verifyJwtToken(token: string): {
  valid: boolean;
  error?: string;
  payload?: JwtPayload;
} {
  const secret = process.env.JWT_SECRET ?? 'test-jwt-secret';

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check for token reuse detection
 * Call this after a 401 to see if refresh sessions were revoked
 */
export async function checkTokenReuseDetection(
  dataSource: any,
  staffUid: string,
): Promise<void> {
  const sessions = await dataSource.query(
    'SELECT id, revoked_at, last_used_at FROM refresh_sessions WHERE staff_uid = ? ORDER BY id DESC LIMIT 5',
    [staffUid],
  );

  console.log('\n[Refresh Sessions for', staffUid, ']');
  console.log(sessions);

  const revokedCount = sessions.filter(
    (s: any) => s.revoked_at !== null,
  ).length;
  if (revokedCount > 0) {
    console.log(
      '⚠️ ',
      revokedCount,
      'sessions revoked - possible token reuse detected',
    );
  }
}
