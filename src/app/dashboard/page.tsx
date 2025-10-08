import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, FileText, Upload } from "lucide-react";
import Link from "next/link";

async function getDashboardData(teacherId: string, schoolId: string) {
  const [students, materials, recentReports] = await Promise.all([
    prisma.student.count({
      where: { teacherId },
    }),
    prisma.learningMaterial.count({
      where: {
        teacher: {
          schoolId: schoolId,
        },
      },
    }),
    prisma.studentReport.findMany({
      where: {
        student: {
          teacherId,
        },
      },
      include: {
        student: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  return {
    studentsCount: students,
    materialsCount: materials,
    recentReports,
  };
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const dashboardData = await getDashboardData(
    session.user.id,
    session.user.schoolId || ""
  );

  return (
    <DashboardLayout>
      <div className='p-8'>
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Welcome, {session.user.name}
          </h1>
          <p className='text-gray-600 mt-2'>
            {session.user.schoolName} •{" "}
            {session.user.isAdmin ? "Administrator" : "Teacher"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>My Students</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {dashboardData.studentsCount}
                </p>
              </div>
              <div className='bg-blue-100 p-3 rounded-full'>
                <Users className='h-6 w-6 text-blue-600' />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Learning Materials
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {dashboardData.materialsCount}
                </p>
              </div>
              <div className='bg-green-100 p-3 rounded-full'>
                <FileText className='h-6 w-6 text-green-600' />
              </div>
            </div>
          </div>
          {/*
          <div className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Recent Reports
                </p>
                <p className='text-2xl font-bold text-gray-900'>
                  {dashboardData.recentReports.length}
                </p>
              </div>
              <div className='bg-yellow-100 p-3 rounded-full'>
                <BookOpen className='h-6 w-6 text-yellow-600' />
              </div>
            </div>
          </div> */}

          <Link href='/materials' className='bg-white rounded-lg shadow p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Quick Actions
                </p>
                <p className='text-sm text-gray-500'>Upload & Manage</p>
              </div>
              <div className='bg-purple-100 p-3 rounded-full'>
                <Upload className='h-6 w-6 text-purple-600' />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Reports */}
        {/* <div className='bg-white rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200'>
            <h2 className='text-lg font-medium text-gray-900'>
              Recent Student Reports
            </h2>
          </div>
          <div className='p-6'>
            {dashboardData.recentReports.length > 0 ? (
              <div className='space-y-4'>
                {dashboardData.recentReports.map((report) => (
                  <div
                    key={report.id}
                    className='border-l-4 border-blue-400 pl-4'
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          {report.title}
                        </h3>
                        <p className='text-sm text-gray-600'>
                          Student: {report.student.name}
                        </p>
                      </div>
                      <div className='text-sm text-gray-500'>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <p className='text-sm text-gray-700 mt-1 line-clamp-2'>
                      {report.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <BookOpen className='mx-auto h-12 w-12 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>
                  No reports yet
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  Start by adding students and creating progress reports.
                </p>
              </div>
            )}
          </div>
        </div> */}
      </div>
    </DashboardLayout>
  );
}
