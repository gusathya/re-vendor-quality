import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import { createUser, getUserByEmail, updateUserLogin } from "./db/users";
import { createVendor, getVendorByName } from "./db/vendors";

const DEMO_USERS = [
  {
    email: "admin@lf",
    password: "admin123",
    role: "admin" as const,
    previousEmails: ["admin@leadership-fractal.local"],
  },
  {
    email: "vendor@lf",
    password: "vendor123",
    role: "vendor" as const,
    previousEmails: ["vendor@unique-platers.local"],
  },
  {
    email: "customer@lf",
    password: "customer123",
    role: "customer" as const,
    previousEmails: ["customer@royalenfield.local"],
  },
];

/** Idempotent. Safe to run on every process start / first DB open. */
export function ensureDemoUsers(db: Database.Database): void {
  let vendor = getVendorByName(db, "Unique Platers");
  if (!vendor) {
    vendor = createVendor(db, {
      name: "Unique Platers",
      processName: "Alkaline Zinc Iron Plating (Barrel)",
    });
  }

  for (const demo of DEMO_USERS) {
    const passwordHash = bcrypt.hashSync(demo.password, 10);
    const existing =
      getUserByEmail(db, demo.email) ??
      demo.previousEmails.map((email) => getUserByEmail(db, email)).find(Boolean) ??
      null;

    if (existing) {
      updateUserLogin(db, existing.id, { email: demo.email, passwordHash });
      continue;
    }

    createUser(db, {
      email: demo.email,
      passwordHash,
      role: demo.role,
      vendorId: demo.role === "vendor" ? vendor.id : null,
    });
  }
}
