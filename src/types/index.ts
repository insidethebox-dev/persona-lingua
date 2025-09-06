import {
  School,
  Teacher,
  Student,
  StudentReport,
  LearningMaterial,
  Recommendation,
} from "@prisma/client";
import { LearningBarrier } from "@/constants/materials";

// Extended Student type with learningBarriers
export type StudentWithLearningBarriers = Student & {
  learningBarriers: LearningBarrier[];
};

// Extended types with relations
export type SchoolWithTeachers = School & {
  teachers: Teacher[];
};

export type TeacherWithSchool = Teacher & {
  school: School;
};

export type StudentWithTeacher = StudentWithLearningBarriers & {
  teacher: Teacher;
};

export type StudentWithReports = StudentWithLearningBarriers & {
  teacher: {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    bio: string | null;
    profilePicture: string | null;
  };
  reports: StudentReport[];
  recommendations: RecommendationWithMaterial[];
};

export type RecommendationWithMaterial = Recommendation & {
  learningMaterial: LearningMaterial;
};

// Form types
export interface CreateSchoolForm {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CreateTeacherForm {
  name: string;
  email: string;
  password: string;
  schoolId: string;
  isAdmin?: boolean;
}

export interface CreateStudentForm {
  name: string;
  age?: number;
  grade?: string;
  notes?: string;
}

export interface CreateReportForm {
  title: string;
  content: string;
  studentId: string;
}

export interface UpdateReportForm extends CreateReportForm {
  id: string;
}

export interface UploadMaterialForm {
  title: string;
  description?: string;
  tags: string[];
  file: File;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  schoolId: string;
  isAdmin: boolean;
}

// AI Recommendation types
export interface AIRecommendationRequest {
  studentReports: string[];
  availableMaterials: LearningMaterial[];
}

export interface AIRecommendationResponse {
  recommendations: {
    materialId: string;
    reason: string;
    confidence: number;
  }[];
}
