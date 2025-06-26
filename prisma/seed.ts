import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo school with admin credentials
  const school = await prisma.school.create({
    data: {
      name: "Demo School",
      address: "123 Education Street, Learning City, LC 12345",
      phone: "+1-555-123-4567",
      email: "admin@demoschool.edu", // School admin login email
      password: await bcrypt.hash("admin123", 12), // School admin password
    },
  });

  console.log(`✅ Created school admin: ${school.name} (${school.email})`);

  // Create regular teachers
  const teacherPassword = await bcrypt.hash("teacher123", 12);

  const teacher = await prisma.teacher.create({
    data: {
      email: "teacher@demoschool.edu",
      name: "Jane Smith",
      password: teacherPassword,
      schoolId: school.id,
      subject: "Mathematics",
      bio: "Experienced math teacher with 10 years of experience.",
    },
  });

  console.log(`✅ Created teacher: ${teacher.name} (${teacher.email})`);

  // Create an independent teacher (no school)
  const independentTeacher = await prisma.teacher.create({
    data: {
      email: "independent@teacher.com",
      name: "John Doe",
      password: teacherPassword,
      schoolId: null, // Independent teacher
      subject: "English",
      bio: "Independent English tutor specializing in creative writing.",
    },
  });

  console.log(
    `✅ Created independent teacher: ${independentTeacher.name} (${independentTeacher.email})`
  );

  // Create some demo students
  const students = await Promise.all([
    prisma.student.create({
      data: {
        name: "Alice Johnson",
        age: 12,
        grade: "7th Grade",
        notes:
          "Excellent in mathematics, needs help with reading comprehension.",
        teacherId: teacher.id,
      },
    }),
    prisma.student.create({
      data: {
        name: "Bob Wilson",
        age: 13,
        grade: "8th Grade",
        notes: "Strong in science, creative in art projects.",
        teacherId: teacher.id,
      },
    }),
    prisma.student.create({
      data: {
        name: "Carol Davis",
        age: 11,
        grade: "6th Grade",
        notes: "Shows great potential in language arts and writing.",
        teacherId: teacher.id,
      },
    }),
  ]);

  console.log(`✅ Created ${students.length} demo students`);

  // Create some demo student reports
  const reports = await Promise.all([
    prisma.studentReport.create({
      data: {
        title: "Math Progress Report",
        content:
          "Alice has shown excellent progress in algebra. She quickly grasps new concepts and helps other students. However, she struggles with word problems and needs more practice in reading comprehension to better understand mathematical scenarios.",
        studentId: students[0].id,
      },
    }),
    prisma.studentReport.create({
      data: {
        title: "Science Project Evaluation",
        content:
          "Bob demonstrated exceptional creativity and scientific thinking in his volcano project. His hypothesis was well-formed and his experimental method was sound. He would benefit from more challenging science materials.",
        studentId: students[1].id,
      },
    }),
    prisma.studentReport.create({
      data: {
        title: "Creative Writing Assessment",
        content:
          "Carol has a natural talent for storytelling and creative writing. Her vocabulary is advanced for her age, and she uses descriptive language effectively. She should be encouraged to participate in writing competitions.",
        studentId: students[2].id,
      },
    }),
  ]);

  console.log(`✅ Created ${reports.length} demo reports`);

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📝 Demo Accounts:");
  console.log("👑 Admin: admin@demoschool.edu / admin123");
  console.log("👩‍🏫 Teacher: teacher@demoschool.edu / teacher123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
