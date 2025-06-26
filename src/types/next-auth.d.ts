import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      schoolId: string | null;
      isAdmin: boolean;
      isSchoolAdmin: boolean;
      schoolName: string;
      profilePicture?: string;
      userType: "school" | "teacher";
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    schoolId: string | null;
    isAdmin: boolean;
    isSchoolAdmin: boolean;
    schoolName: string;
    profilePicture?: string;
    userType: "school" | "teacher";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    schoolId: string | null;
    isAdmin: boolean;
    isSchoolAdmin: boolean;
    schoolName: string;
    profilePicture?: string;
    userType: "school" | "teacher";
  }
}
