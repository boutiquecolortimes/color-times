/**
 * Create or update an admin-panel team member (staff/admin/developer/
 * super_admin). Upserts by email, so it's also the way to reset someone's
 * password/role or reactivate a locked/deactivated/trashed account — safe
 * to re-run.
 *
 * Usage:
 *   npm run seed:team-member -- --name "Sneha" --email sneha@colortimes.com --password 'Sneha@2026' --role super_admin
 *
 * Roles: staff | admin | developer | super_admin
 * (Do not use this for customer accounts — those sign up through /register.)
 */
import { connectToDatabase } from "@/lib/db/connect";
import { User, type UserRole } from "@/models/User";
import { hashPassword } from "@/lib/auth/password";

const TEAM_ROLES: UserRole[] = ["staff", "admin", "developer", "super_admin"];

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return undefined;
  return process.argv[index + 1];
}

function printUsageAndExit(message: string): never {
  console.error(message);
  console.error(
    'Usage: npm run seed:team-member -- --name "Full Name" --email person@example.com --password \'Secret123!\' --role staff|admin|developer|super_admin'
  );
  process.exit(1);
}

async function main() {
  const name = getArg("--name");
  const email = getArg("--email")?.toLowerCase();
  const password = getArg("--password");
  const role = getArg("--role") as UserRole | undefined;

  if (!name || !email || !password || !role) {
    printUsageAndExit("Missing required argument.");
  }
  if (!TEAM_ROLES.includes(role)) {
    printUsageAndExit(`Invalid role "${role}". Must be one of: ${TEAM_ROLES.join(", ")}`);
  }
  if (password.length < 8) {
    printUsageAndExit("Password must be at least 8 characters.");
  }

  await connectToDatabase();

  const passwordHash = await hashPassword(password);

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        email,
        passwordHash,
        role,
        isEmailVerified: true,
        isActive: true,
        deletedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Team member ready: ${user.email} (role: ${user.role}, id: ${user._id})`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to seed team member:", error);
  process.exit(1);
});
