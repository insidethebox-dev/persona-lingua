"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Image from "next/image";
import {
  Plus,
  Users,
  FileText,
  Calendar,
  Edit,
  Trash2,
  X,
  BookOpen,
  Lightbulb,
  ArrowLeft,
  Mail,
  User,
} from "lucide-react";
import { ApiResponse, StudentWithReports } from "@/types";
import {
  StudentReport,
  Recommendation,
  LearningMaterial,
} from "@prisma/client";
import Link from "next/link";

type RecommendationWithMaterial = Recommendation & {
  learningMaterial: LearningMaterial;
};

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<StudentWithReports | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendationWithMaterial[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReport, setEditingReport] = useState<StudentReport | null>(
    null
  );
  const [reportFormData, setReportFormData] = useState({
    title: "",
    content: "",
  });
  const [generatingRecommendations, setGeneratingRecommendations] =
    useState(false);

  // Only teachers (not school admins) can manage student reports
  const isTeacher = session?.user && !session.user.isSchoolAdmin;

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showReportForm &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowReportForm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showReportForm]);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  const fetchStudent = async () => {
    try {
      const response = await fetch(`/api/students/${studentId}`);
      const data: ApiResponse<StudentWithReports> = await response.json();

      if (data.success && data.data) {
        setStudent(data.data);
      } else {
        console.error("Failed to fetch student:", data.error);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(
        `/api/recommendations?studentId=${studentId}`
      );
      const data: ApiResponse<RecommendationWithMaterial[]> =
        await response.json();

      if (data.success && data.data) {
        setRecommendations(data.data);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchStudent();
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleAddReport = () => {
    setEditingReport(null);
    setReportFormData({ title: "", content: "" });
    setShowReportForm(true);
  };

  const handleEditReport = (report: StudentReport) => {
    setEditingReport(report);
    setReportFormData({
      title: report.title,
      content: report.content,
    });
    setShowReportForm(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEdit = !!editingReport;
    const url = isEdit ? `/api/reports?id=${editingReport.id}` : "/api/reports";
    const method = isEdit ? "PUT" : "POST";

    const body = {
      ...reportFormData,
      studentId,
      ...(isEdit && { id: editingReport.id }),
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setShowReportForm(false);
        setReportFormData({ title: "", content: "" });
        setEditingReport(null);
        fetchStudent(); // Refresh to get updated reports
      } else {
        alert(data.error || "Failed to save report");
      }
    } catch (error) {
      console.error("Error saving report:", error);
      alert("Failed to save report");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) {
      return;
    }

    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        fetchStudent(); // Refresh to get updated reports
      } else {
        alert(data.error || "Failed to delete report");
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("Failed to delete report");
    }
  };

  const generateRecommendations = async () => {
    setGeneratingRecommendations(true);
    try {
      const response = await fetch(`/api/recommendations/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        fetchRecommendations(); // Refresh recommendations
        alert(`Successfully generated recommendations! ${data.message}`);
      } else {
        alert(data.error || "Failed to generate recommendations");
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      alert("Failed to generate recommendations");
    } finally {
      setGeneratingRecommendations(false);
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

  if (!student) {
    return (
      <DashboardLayout>
        <div className='p-8'>
          <div className='text-center py-12'>
            <Users className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              Student not found
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              The student you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have access to view them.
            </p>
            <div className='mt-6'>
              <Link
                href='/students'
                className='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700'
              >
                <ArrowLeft className='mr-2 h-4 w-4' />
                Back to Students
              </Link>
            </div>
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
          <div className='flex items-center gap-4'>
            <Link
              href='/students'
              className='text-gray-600 hover:text-gray-800'
            >
              <ArrowLeft className='h-6 w-6' />
            </Link>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>
                {student.name}
              </h1>
              <div className='flex items-center gap-4 text-sm text-gray-500 mt-1'>
                {student.age && <span>Age: {student.age}</span>}
                {student.grade && <span>Grade: {student.grade}</span>}
                <span>
                  Joined: {new Date(student.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className='mb-8'>
          <h2 className='text-lg font-medium text-gray-900 mb-3'>Notes</h2>
          {student.notes ? (
            <div className='bg-gray-50 rounded-lg p-4'>
              <p className='text-gray-700'>{student.notes}</p>
            </div>
          ) : (
            <div className='bg-gray-50 rounded-lg p-4'>
              <p className='text-gray-500 italic'>No notes available</p>
            </div>
          )}
        </div>

        {/* About the Teacher */}
        {student.teacher && (
          <div className='mb-8'>
            <h2 className='text-lg font-medium text-gray-900 mb-4 flex items-center gap-2'>
              <User className='h-5 w-5' />
              About the Teacher
            </h2>
            <div className='bg-white border rounded-lg p-6'>
              <div className='flex items-start gap-4'>
                <div className='flex-shrink-0'>
                  {student.teacher.profilePicture ? (
                    <Image
                      src={student.teacher.profilePicture}
                      alt={`${student.teacher.name}'s profile`}
                      width={80}
                      height={80}
                      className='w-20 h-20 rounded-full object-cover'
                    />
                  ) : (
                    <div className='w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center'>
                      <User className='w-8 h-8 text-gray-400' />
                    </div>
                  )}
                </div>
                <div className='flex-1'>
                  <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                    {student.teacher.name}
                  </h3>
                  {student.teacher.subject && (
                    <p className='text-sm text-blue-600 font-medium mb-2'>
                      {student.teacher.subject}
                    </p>
                  )}
                  {student.teacher.bio && (
                    <p className='text-gray-600 mb-4'>{student.teacher.bio}</p>
                  )}
                  <a
                    href={`mailto:${student.teacher.email}`}
                    className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors'
                  >
                    <Mail className='w-4 h-4' />
                    Contact Teacher
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Reports Section */}
          <div className='space-y-6'>
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                <FileText className='h-5 w-5' />
                Progress Reports ({student.reports?.length || 0})
              </h2>
              {isTeacher && (
                <button
                  onClick={handleAddReport}
                  className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm'
                >
                  <Plus className='h-4 w-4' />
                  Add Report
                </button>
              )}
            </div>

            {student.reports && student.reports.length > 0 ? (
              <div className='space-y-4'>
                {student.reports.map((report) => (
                  <div
                    key={report.id}
                    className='bg-white border rounded-lg p-6'
                  >
                    <div className='flex items-start justify-between mb-3'>
                      <h3 className='font-medium text-gray-900'>
                        {report.title}
                      </h3>
                      {isTeacher && (
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
                      )}
                    </div>
                    <p className='text-gray-700 text-sm mb-3 whitespace-pre-wrap'>
                      {report.content}
                    </p>
                    <p className='text-xs text-gray-500 flex items-center gap-1'>
                      <Calendar className='h-3 w-3' />
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8 bg-gray-50 rounded-lg'>
                <FileText className='mx-auto h-8 w-8 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>
                  No reports yet
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {isTeacher
                    ? "Start by adding a progress report for this student."
                    : "No progress reports have been added yet."}
                </p>
              </div>
            )}
          </div>

          {/* Recommendations Section */}
          <div className='space-y-6'>
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                <Lightbulb className='h-5 w-5' />
                AI Recommendations ({recommendations.length})
              </h2>
              {isTeacher && student.reports && student.reports.length > 0 && (
                <button
                  onClick={generateRecommendations}
                  disabled={generatingRecommendations}
                  className='bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 text-sm'
                >
                  <Lightbulb className='h-4 w-4' />
                  {generatingRecommendations
                    ? "Generating..."
                    : "Generate Recommendations"}
                </button>
              )}
            </div>

            {recommendations.length > 0 ? (
              <>
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4'>
                  <p className='text-sm text-blue-800'>
                    <strong>Smart Recommendations:</strong> These suggestions
                    are generated using our two-step AI process that first
                    analyzes the student&apos;s progress reports to identify
                    learning needs, then filters and recommends the most
                    suitable materials from our database.
                  </p>
                </div>
                <div className='space-y-4'>
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className='bg-white border rounded-lg p-6'
                    >
                      <div className='flex items-start justify-between mb-3'>
                        <h3 className='font-medium text-gray-900'>
                          {rec.learningMaterial.title}
                        </h3>
                        <div className='flex items-center gap-1 text-xs'>
                          <div className='bg-green-100 text-green-800 px-2 py-1 rounded'>
                            {Math.round(rec.confidence * 100)}% match
                          </div>
                        </div>
                      </div>

                      {rec.learningMaterial.description && (
                        <p className='text-sm text-gray-600 mb-2'>
                          {rec.learningMaterial.description}
                        </p>
                      )}

                      <p className='text-sm text-blue-700 mb-3 italic'>
                        &quot;{rec.reason}&quot;
                      </p>

                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2 text-xs text-gray-500 flex-wrap'>
                          <span className='bg-gray-100 px-2 py-1 rounded'>
                            {rec.learningMaterial.topic}
                          </span>
                          <span className='bg-gray-100 px-2 py-1 rounded'>
                            {rec.learningMaterial.level}
                          </span>
                          <span className='bg-gray-100 px-2 py-1 rounded'>
                            {rec.learningMaterial.type}
                          </span>
                          <span className='bg-gray-100 px-2 py-1 rounded'>
                            {rec.learningMaterial.skill}
                          </span>
                        </div>
                        <div className='flex gap-2'>
                          <a
                            href={rec.learningMaterial.fileUrl || "#"}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1'
                          >
                            <BookOpen className='h-4 w-4' />
                            View Material
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className='text-center py-8 bg-gray-50 rounded-lg'>
                <Lightbulb className='mx-auto h-8 w-8 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>
                  No recommendations yet
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {student.reports && student.reports.length > 0
                    ? "Click 'Generate Recommendations' to get AI-powered learning material suggestions based on this student's progress reports."
                    : "Add progress reports to get AI-powered learning material recommendations."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Report Form Modal */}
        {showReportForm && isTeacher && (
          <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
            <div
              ref={modalRef}
              className='bg-white rounded-lg shadow-lg max-w-2xl w-full'
            >
              <div className='flex items-center justify-between p-6 border-b'>
                <h2 className='text-lg font-medium text-gray-900'>
                  {editingReport ? "Edit Report" : "Add New Report"} for{" "}
                  {student.name}
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
