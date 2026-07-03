import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";
import { assertUniqueUserIdentity } from "@/lib/user-identity";
import { purgeDeletedUsersByIdentity } from "@/lib/user-repositories";

export type UserRole = "student" | "instructor" | "staff" | "admin";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled" | "pending";
  phone: string | null;
  citizenId: string | null;
  address: string | null;
}

const sessionCookieName = "spc_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const passwordResetMaxAgeSeconds = 60 * 30;

function shouldUseSecureCookies() {
  const override = process.env.AUTH_SECURE_COOKIES?.trim().toLowerCase();
  if (override) {
    return ["1", "true", "yes", "on"].includes(override);
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function expiresAtFromNow() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000);
}

function passwordResetExpiresAtFromNow() {
  return new Date(Date.now() + passwordResetMaxAgeSeconds * 1000);
}

function toMysqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function roleRedirect(role: UserRole) {
  return role === "student" ? "/my-learning" : "/admin/dashboard";
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;

  const rows = await queryRows<RowDataPacket & CurrentUser>(
    `SELECT u.id, u.name, u.email, u.role, u.status,
            p.phone, p.citizen_id AS citizenId, p.address
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE s.token_hash = ?
       AND s.expires_at > NOW()
       AND u.status = 'active'
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [hashToken(token)],
  );

  const user = rows[0];
  if (!user) return null;

  executeQuery<ResultSetHeader>(
    "UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = ?",
    [hashToken(token)],
  ).catch(() => {});

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    citizenId: user.citizenId,
    address: user.address,
  };
}

export async function requireCurrentUser(roles?: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  if (roles && !roles.includes(user.role)) {
    redirect(roleRedirect(user.role));
  }

  return user;
}

export async function createSession(user: Pick<CurrentUser, "id" | "role">) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = expiresAtFromNow();
  const headerStore = await headers();

  await executeQuery<ResultSetHeader>(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent)
     VALUES (?, ?, ?, ?)`,
    [
      user.id,
      hashToken(token),
      toMysqlDate(expiresAt),
      headerStore.get("user-agent")?.slice(0, 500) ?? null,
    ],
  );

  (await cookies()).set(sessionCookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await executeQuery<ResultSetHeader>("DELETE FROM user_sessions WHERE token_hash = ?", [
      hashToken(token),
    ]).catch(() => {});
  }
  cookieStore.delete(sessionCookieName);
}

export async function signInWithPassword(email: string, password: string) {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      status: CurrentUser["status"];
    }
  >(
    `SELECT id, name, email, password_hash, role, status
     FROM users
     WHERE email = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );

  const user = rows[0];
  if (!user || user.status !== "active") return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  await executeQuery<ResultSetHeader>("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
    user.id,
  ]);

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function createPasswordResetToken(email: string) {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      status: CurrentUser["status"];
    }
  >(
    `SELECT id, status
     FROM users
     WHERE email = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );

  const user = rows[0];
  if (!user || user.status !== "active") return null;

  const token = randomBytes(32).toString("base64url");

  await executeQuery<ResultSetHeader>(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = ?
       AND used_at IS NULL`,
    [user.id],
  );

  await executeQuery<ResultSetHeader>(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, hashToken(token), toMysqlDate(passwordResetExpiresAtFromNow())],
  );

  await executeQuery<ResultSetHeader>(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
     VALUES (?, 'auth.password_reset_requested', 'user', ?, JSON_OBJECT('channel', 'local_reset_link'))`,
    [user.id, user.id],
  ).catch(() => {});

  return token;
}

export async function resetPasswordWithToken(token: string, password: string) {
  const rows = await queryRows<
    RowDataPacket & {
      tokenId: number;
      userId: number;
      name: string;
      email: string;
      role: UserRole;
      status: CurrentUser["status"];
    }
  >(
    `SELECT t.id AS tokenId, u.id AS userId, u.name, u.email, u.role, u.status
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?
       AND t.expires_at > NOW()
       AND t.used_at IS NULL
       AND u.status = 'active'
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [hashToken(token)],
  );

  const resetRequest = rows[0];
  if (!resetRequest) {
    throw new Error("Password reset token is invalid or expired.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await executeQuery<ResultSetHeader>(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, resetRequest.userId],
  );
  await executeQuery<ResultSetHeader>(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
    [resetRequest.tokenId],
  );
  await executeQuery<ResultSetHeader>("DELETE FROM user_sessions WHERE user_id = ?", [
    resetRequest.userId,
  ]);

  await executeQuery<ResultSetHeader>(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
     VALUES (?, 'auth.password_reset_completed', 'user', ?, JSON_OBJECT('channel', 'local_reset_link'))`,
    [resetRequest.userId, resetRequest.userId],
  ).catch(() => {});

  return {
    id: Number(resetRequest.userId),
    name: resetRequest.name,
    email: resetRequest.email,
    role: resetRequest.role,
    status: resetRequest.status,
  };
}

export async function createStudentUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  await purgeDeletedUsersByIdentity({
    email: input.email,
    phone: input.phone,
  });

  await assertUniqueUserIdentity({
    email: input.email,
    phone: input.phone,
  });

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [result] = await executeQuery<ResultSetHeader>(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES (?, ?, ?, 'student', 'active')`,
    [input.name, input.email, passwordHash],
  );

  await executeQuery<ResultSetHeader>(
    `INSERT INTO profiles (user_id, phone)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE phone = VALUES(phone)`,
    [result.insertId, input.phone ?? null],
  );

  return {
    id: result.insertId,
    name: input.name,
    email: input.email,
    role: "student" as const,
    status: "active" as const,
  };
}

export function getRoleRedirect(role: UserRole) {
  return roleRedirect(role);
}

export function getSessionCookieName() {
  return sessionCookieName;
}
