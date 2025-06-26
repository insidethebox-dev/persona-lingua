"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Plus,
  GraduationCap,
  FileText,
  Calendar,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { ApiResponse, StudentWithReports } from "@/types";
import { StudentReport } from "@prisma/client";

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [students, setStudents] = useState<StudentWithReports[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentWithReports | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReport, setEditingReport] = useState<StudentReport | null>(
    null
  );
  const [reportFormData, setReportFormData] = useState({
    title: "",
    content: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    grade: "",
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students");
      const data: ApiResponse<StudentWithReports[]> = await response.json();

      if (data.success && data.data) {
        setStudents(data.data);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setFormData({ name: "", age: "", grade: "", notes: "" });
        setShowAddForm(false);
        fetchStudents();
      } else {
        alert(data.error || "Failed to create student");
      }
    } catch (error) {
      console.error("Error creating student:", error);
      alert("Failed to create student");
    }
  };

  const handleAddReport = (student: StudentWithReports) => {
    setSelectedStudent(student);
    setEditingReport(null);
    setReportFormData({ title: "", content: "" });
    setShowReportForm(true);
  };

  const handleEditReport = (report: StudentReport) => {
    setEditingReport(report);
    setReportFormData({ title: report.title, content: report.content });
    setShowReportForm(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      const url = "/api/reports";
      const method = editingReport ? "PUT" : "POST";
      const body = editingReport
        ? {
            ...reportFormData,
            id: editingReport.id,
            studentId: selectedStudent.id,
          }
        : { ...reportFormData, studentId: selectedStudent.id };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setReportFormData({ title: "", content: "" });
        setShowReportForm(false);
        setEditingReport(null);
        fetchStudents(); // Refresh to get updated reports
      } else {
        alert(data.error || "Failed to save report");
      }
    } catch (error) {
      console.error("Error saving report:", error);
      alert("Failed to save report");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;

    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        fetchStudents(); // Refresh to get updated reports
      } else {
        alert(data.error || "Failed to delete report");
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("Failed to delete report");
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

  if (!session?.user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className='p-8'>
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>My Students</h1>
            <p className='text-gray-600 mt-2'>
              Manage your students and track their progress
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2'
          >
            <Plus className='h-4 w-4' />
            Add Student
          </button>
        </div>

        {/* Add Student Form */}
        {showAddForm && (
          <div className='bg-white rounded-lg shadow p-6 mb-8'>
            <h2 className='text-lg font-medium text-gray-900 mb-4'>
              Add New Student
            </h2>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Name *
                  </label>
                  <input
                    type='text'
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Age
                  </label>
                  <input
                    type='number'
                    min='3'
                    max='18'
                    value={formData.age}
                    onChange={(e) =>
                      setFormData({ ...formData, age: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Grade
                  </label>
                  <input
                    type='text'
                    value={formData.grade}
                    onChange={(e) =>
                      setFormData({ ...formData, grade: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div className='flex gap-3'>
                <button
                  type='submit'
                  className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700'
                >
                  Add Student
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
        )}

        {/* Students List */}
        {students.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {students.map((student) => (
              <div key={student.id} className='bg-white rounded-lg shadow p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='flex items-center gap-3'>
                    <div className='bg-blue-100 p-2 rounded-full'>
                      <GraduationCap className='h-5 w-5 text-blue-600' />
                    </div>
                    <div>
                      <h3 className='font-medium text-gray-900'>
                        {student.name}
                      </h3>
                      {student.grade && (
                        <p className='text-sm text-gray-500'>
                          Grade {student.grade}
                        </p>
                      )}
                    </div>
                  </div>
                  {student.age && (
                    <span className='text-sm text-gray-500'>
                      Age {student.age}
                    </span>
                  )}
                </div>

                <div className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-gray-600'>
                    <FileText className='h-4 w-4' />
                    <span>{student.reports?.length || 0} reports</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm text-gray-600'>
                    <Calendar className='h-4 w-4' />
                    <span>
                      Added {new Date(student.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {student.notes && (
                  <div className='mt-4 p-3 bg-gray-50 rounded-md'>
                    <p className='text-sm text-gray-700'>{student.notes}</p>
                  </div>
                )}

                <div className='mt-4 flex gap-2'>
                  <Link
                    href={`/students/${student.id}`}
                    className='flex-1 text-sm bg-blue-50 text-blue-700 py-2 px-3 rounded-md hover:bg-blue-100 text-center'
                  >
                    View Student
                  </Link>
                  <button
                    onClick={() => handleAddReport(student)}
                    className='flex-1 text-sm bg-green-50 text-green-700 py-2 px-3 rounded-md hover:bg-green-100'
                  >
                    Add Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <GraduationCap className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              No students yet
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              Get started by adding your first student.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className='mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto'
            >
              <Plus className='h-4 w-4' />
              Add Student
            </button>
          </div>
        )}

        {/* Reports Modal */}
        {showReports && selectedStudent && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden'>
              <div className='flex items-center justify-between p-6 border-b'>
                <h2 className='text-lg font-medium text-gray-900'>
                  Reports for {selectedStudent.name}
                </h2>
                <button
                  onClick={() => setShowReports(false)}
                  className='text-gray-400 hover:text-gray-600'
                >
                  <X className='h-6 w-6' />
                </button>
              </div>
              <div className='p-6 overflow-y-auto max-h-[70vh]'>
                {selectedStudent.reports &&
                selectedStudent.reports.length > 0 ? (
                  <div className='space-y-4'>
                    {selectedStudent.reports.map((report) => (
                      <div key={report.id} className='border rounded-lg p-4'>
                        <div className='flex items-center justify-between mb-2'>
                          <h3 className='font-medium text-gray-900'>
                            {report.title}
                          </h3>
                          <div className='flex gap-2'>
                            <button
                              onClick={() => handleEditReport(report)}
                              className='text-blue-600 hover:text-blue-800'
                            >
                              <Edit className='h-4 w-4' />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className='text-red-600 hover:text-red-800'
                            >
                              <Trash2 className='h-4 w-4' />
                            </button>
                          </div>
                        </div>
                        <p className='text-gray-700 text-sm mb-2'>
                          {report.content}
                        </p>
                        <p className='text-xs text-gray-500'>
                          Created: {new Date(report.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-8'>
                    <FileText className='mx-auto h-12 w-12 text-gray-400' />
                    <h3 className='mt-2 text-sm font-medium text-gray-900'>
                      No reports yet
                    </h3>
                    <p className='mt-1 text-sm text-gray-500'>
                      Start by adding a progress report for this student.
                    </p>
                    <button
                      onClick={() => handleAddReport(selectedStudent)}
                      className='mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
                    >
                      Add First Report
                    </button>
                  </div>
                )}
              </div>
              <div className='flex justify-end gap-3 p-6 border-t'>
                <button
                  onClick={() => handleAddReport(selectedStudent)}
                  className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add Report
                </button>
                <button
                  onClick={() => setShowReports(false)}
                  className='bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400'
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Form Modal */}
        {showReportForm && selectedStudent && (
          <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-lg shadow-lg max-w-2xl w-full'>
              <div className='flex items-center justify-between p-6 border-b'>
                <h2 className='text-lg font-medium text-gray-900'>
                  {editingReport ? "Edit Report" : "Add New Report"} for{" "}
                  {selectedStudent.name}
                </h2>
                <button
                  onClick={() => setShowReportForm(false)}
                  className='text-gray-400 hover:text-gray-600'
                >
                  <X className='h-6 w-6' />
                </button>
              </div>
              <form onSubmit={handleReportSubmit} className='p-6'>
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Report Title *
                    </label>
                    <input
                      type='text'
                      required
                      value={reportFormData.title}
                      onChange={(e) =>
                        setReportFormData({
                          ...reportFormData,
                          title: e.target.value,
                        })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='e.g., Weekly Progress Report, Assessment Results'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Report Content *
                    </label>
                    <textarea
                      rows={8}
                      required
                      value={reportFormData.content}
                      onChange={(e) =>
                        setReportFormData({
                          ...reportFormData,
                          content: e.target.value,
                        })
                      }
                      className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder="Describe the student's progress, achievements, areas for improvement, etc."
                    />
                  </div>
                </div>
                <div className='flex gap-3 mt-6'>
                  <button
                    type='submit'
                    className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700'
                  >
                    {editingReport ? "Update Report" : "Create Report"}
                  </button>
                  <button
                    type='button'
                    onClick={() => setShowReportForm(false)}
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
