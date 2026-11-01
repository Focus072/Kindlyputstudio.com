// Prints a password hash for the admin_users table.
// Usage: node scripts/hash-password.mjs "the-password"
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "the-password"');
  process.exit(1);
}
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`);
