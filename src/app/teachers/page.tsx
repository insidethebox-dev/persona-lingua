"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Users, Mail, Calendar, Trash2, X, User } from "lucide-react";
import { ApiResponse } from "@/types";
import { Teacher } from "@prisma/client";

type TeacherWithCount = Teacher & {
  _count: {
    students: number;
  };
};

export default function TeachersPage() {
  const { data: session, status } = useSession();
  const [teachers, setTeachers] = useState<TeacherWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    subject: "",
    bio: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  useEffect(() => {
    if (session?.user && !session.user.isSchoolAdmin) {
      redirect("/dashboard");
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.isSchoolAdmin) {
      fetchTeachers();
    }
  }, [session]);

  const fetchTeachers = async () => {
    try {
      const response = await fetch("/api/teachers");
      const data: ApiResponse<TeacherWithCount[]> = await response.json();

      if (data.success && data.data) {
        setTeachers(data.data);
      } else {
        console.error("Failed to fetch teachers:", data.error);
      }
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setFormData({
          name: "",
          email: "",
          password: "",
          subject: "",
          bio: "",
        });
        setShowAddForm(false);
        fetchTeachers();
        alert("Teacher created successfully!");
      } else {
        alert(data.error || "Failed to create teacher");
      }
    } catch (error) {
      console.error("Error creating teacher:", error);
      alert("Failed to create teacher");
    }
  };

  const handleDelete = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Are you sure you want to delete teacher "${teacherName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/teachers?id=${teacherId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        fetchTeachers();
        alert("Teacher deleted successfully!");
      } else {
        alert(data.error || "Failed to delete teacher");
      }
    } catch (error) {
      console.error("Error deleting teacher:", error);
      alert("Failed to delete teacher");
    }
  };

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className='p-8'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-gray-500'>Loading...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session?.user?.isSchoolAdmin) {
    return (
      <DashboardLayout>
        <div className='p-8'>
          <div className='text-center py-12'>
            <Users className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              Access Denied
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              Only school administrators can access teacher management.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className='p-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Teachers</h1>
            <p className='text-gray-600'>Manage teachers for your school</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2'
          >
            <Plus className='h-5 w-5' />
            Add Teacher
          </button>
        </div>

        {/* Teachers Grid */}
        {teachers.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className='bg-white border rounded-lg p-6 hover:shadow-md transition-shadow'
              >
                <div className='flex items-start justify-between mb-4'>
                  <div className='flex items-center gap-3'>
                    {teacher.profilePicture ? (
                      <Image
                        src={teacher.profilePicture}
                        alt={teacher.name}
                        width={48}
                        height={48}
                        className='w-12 h-12 rounded-full object-cover'
                      />
                    ) : (
                      <div className='w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center'>
                        <User className='h-6 w-6 text-gray-400' />
                      </div>
                    )}
                    <div>
                      <h3 className='font-medium text-gray-900'>
                        {teacher.name}
                      </h3>
                      {teacher.subject && (
                        <span className='inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1'>
                          {teacher.subject}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() =>
                        window.open(`mailto:${teacher.email}`, "_blank")
                      }
                      className='text-gray-600 hover:text-blue-600 transition-colors'
                      title='Send email'
                    >
                      <Mail className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => handleDelete(teacher.id, teacher.name)}
                      className='text-gray-600 hover:text-red-600 transition-colors'
                      title='Delete teacher'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>

                <div className='space-y-2 text-sm text-gray-600'>
                  <div className='flex items-center gap-2'>
                    <Mail className='h-4 w-4' />
                    <span>{teacher.email}</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Users className='h-4 w-4' />
                    <span>{teacher._count.students} students</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Calendar className='h-4 w-4' />
                    <span>
                      Joined {new Date(teacher.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-12 bg-gray-50 rounded-lg'>
            <Users className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              No teachers yet
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              Start by adding teachers to your school.
            </p>
          </div>
        )}

        {/* Add Teacher Modal */}
        {showAddForm && (
          <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-lg shadow-lg max-w-md w-full'>
              <div className='flex items-center justify-between p-6 border-b'>
                <h2 className='text-lg font-medium text-gray-900'>
                  Add New Teacher
                </h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className='text-gray-400 hover:text-gray-600'
                >
                  <X className='h-6 w-6' />
                </button>
              </div>
              <form onSubmit={handleSubmit} className='p-6'>
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Full Name *
                    </label>
                    <input
                      type='text'
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder="Enter teacher's full name"
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Email Address *
                    </label>
                    <input
                      type='email'
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='Enter email address'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Password *
                    </label>
                    <input
                      type='password'
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='Enter password'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Subject
                    </label>
                    <input
                      type='text'
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='e.g., Mathematics, English'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='Brief description of the teacher'
                      rows={3}
                    />
                  </div>
                </div>
                <div className='flex gap-3 mt-6'>
                  <button
                    type='submit'
                    className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex-1'
                  >
                    Create Teacher
                  </button>
                  <button
                    type='button'
                    onClick={() => setShowAddForm(false)}
                    className='bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
