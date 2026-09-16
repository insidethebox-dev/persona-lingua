/**
 * Reset a user's password from the command line.
 *
 * Looks up the email across School admins and Teachers (same order as
 * src/lib/auth.ts) and stores a bcrypt hash (cost 12) — no need to open
 * Prisma Studio or generate hashes by hand.
 *
 * Usage:
 *   npm run reset:password -- <email> <new-password>
 *   npm run reset:password -- <email>            # generates a random password and prints it
 *
 * Add --school or --teacher to disambiguate if the same email exists in both tables.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

function usage(msg?: string): never {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    "Usage: npm run reset:password -- <email> [new-password] [--school | --teacher]"
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const onlySchool = args.includes("--school");
  const onlyTeacher = args.includes("--teacher");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [email, providedPassword] = positional;

  if (!email) usage("email is required");
  if (onlySchool && onlyTeacher) usage("choose only one of --school / --teacher");

  const password =
    providedPassword ?? randomBytes(9).toString("base64url"); // 12 chars
  if (password.length < 8) usage("password must be at least 8 characters");

  const [school, teacher] = await Promise.all([
    onlyTeacher ? null : prisma.school.findFirst({ where: { email } }),
    onlySchool ? null : prisma.teacher.findUnique({ where: { email } }),
  ]);

  if (!school && !teacher) usage(`no school admin or teacher found with email ${email}`);
  if (school && teacher)
    usage(
      `email ${email} matches both a school admin and a teacher; pass --school or --teacher`
    );

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (school) {
    await prisma.school.update({ where: { id: school.id }, data: { password: hash } });
    console.log(`Updated password for school admin "${school.name}" (${email})`);
  } else if (teacher) {
    await prisma.teacher.update({ where: { id: teacher.id }, data: { password: hash } });
    console.log(`Updated password for teacher "${teacher.name}" (${email})`);
  }

  if (!providedPassword) console.log(`New password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
