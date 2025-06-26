import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // First try to find a school admin
          const school = await prisma.school.findFirst({
            where: {
              email: credentials.email,
              password: { not: null }, // Only schools with passwords set
            },
          });

          if (school && school.password) {
            const isValidPassword = await bcrypt.compare(
              credentials.password,
              school.password
            );

            if (isValidPassword) {
              return {
                id: school.id,
                email: school.email || "",
                name: school.name,
                schoolId: school.id,
                isSchoolAdmin: true,
                isAdmin: true, // Schools are admins
                schoolName: school.name,
                profilePicture: school.profilePicture || undefined,
                userType: "school" as const,
              };
            }
          }

          // If not a school, try to find a teacher
          const teacher = await prisma.teacher.findUnique({
            where: { email: credentials.email },
            include: { school: true },
          });

          if (teacher) {
            const isValidPassword = await bcrypt.compare(
              credentials.password,
              teacher.password
            );

            if (isValidPassword) {
              return {
                id: teacher.id,
                email: teacher.email,
                name: teacher.name,
                schoolId: teacher.schoolId,
                isSchoolAdmin: false,
                isAdmin: false, // Teachers are not admins
                schoolName: teacher.school?.name || "Independent",
                profilePicture: teacher.profilePicture || undefined,
                userType: "teacher" as const,
              };
            }
          }

          return null;
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.schoolId = user.schoolId;
        token.isAdmin = user.isAdmin;
        token.isSchoolAdmin = user.isSchoolAdmin;
        token.schoolName = user.schoolName;
        token.profilePicture = user.profilePicture;
        token.userType = user.userType;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.schoolId = token.schoolId;
        session.user.isAdmin = token.isAdmin;
        session.user.isSchoolAdmin = token.isSchoolAdmin;
        session.user.schoolName = token.schoolName;
        session.user.profilePicture = token.profilePicture;
        session.user.userType = token.userType;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
