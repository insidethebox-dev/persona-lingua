"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Upload, FileText, Tag, BookOpen, Sparkles } from "lucide-react";
import { ApiResponse } from "@/types";
import { AIAnalysisResult } from "@/lib/openai";
import {
  MATERIAL_TOPICS,
  MATERIAL_LEVELS,
  MATERIAL_TYPES,
  MATERIAL_SKILLS,
} from "@/constants/materials";

export default function UploadPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    topic: "",
    level: "",
    type: "",
    skill: "",
    tags: "",
    file: null as File | null,
  });

  if (status === "loading") {
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

  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setFormData({ ...formData, file });
      setError("");

      // Generate AI summary for the file
      generateAISummary(file);
    }
  };

  const generateAISummary = async (file: File) => {
    setAiLoading(true);
    setAiAnalysis(null);

    try {
      const summaryFormData = new FormData();
      summaryFormData.append("file", file);

      const response = await fetch("/api/ai/summary", {
        method: "POST",
        body: summaryFormData,
      });

      const data: ApiResponse<AIAnalysisResult> = await response.json();

      if (data.success && data.data) {
        setAiAnalysis(data.data);
        setFormData((prev) => ({
          ...prev,
          title: data.data!.title || prev.title, // Set AI title if provided
          description: data.data!.description,
          topic: data.data!.topic,
          level: data.data!.level,
          type: data.data!.type,
          skill: data.data!.skill,
          tags: data.data!.tags.join(", "),
        }));
      } else {
        console.error("Failed to generate AI analysis:", data.error);
      }
    } catch (error) {
      console.error("Error generating AI analysis:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!formData.file) {
        setError("Please select a file to upload");
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append("file", formData.file);
      uploadFormData.append("title", formData.title);
      uploadFormData.append("description", formData.description);
      uploadFormData.append("aiSummary", aiAnalysis?.description || "");
      uploadFormData.append("topic", formData.topic);
      uploadFormData.append("level", formData.level);
      uploadFormData.append("type", formData.type);
      uploadFormData.append("skill", formData.skill);
      uploadFormData.append("tags", formData.tags);

      const response = await fetch("/api/materials", {
        method: "POST",
        body: uploadFormData,
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setSuccess("Material uploaded successfully!");
        setFormData({
          title: "",
          description: "",
          topic: "",
          level: "",
          type: "",
          skill: "",
          tags: "",
          file: null,
        });
        setAiAnalysis(null);
        // Reset file input
        const fileInput = document.getElementById("file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setError(data.error || "Failed to upload material");
      }
    } catch {
      setError("An error occurred while uploading");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <DashboardLayout>
      <div className='p-8'>
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Upload Learning Material
          </h1>
          <p className='text-gray-600 mt-2'>
            Upload files and tag them for AI-powered student recommendations
          </p>
        </div>

        <div className='max-w-2xl'>
          <div className='bg-white rounded-lg shadow p-6'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* File Upload */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  File *
                </label>
                <div className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors'>
                  <Upload className='mx-auto h-12 w-12 text-gray-400' />
                  <div className='mt-4'>
                    <label htmlFor='file' className='cursor-pointer'>
                      <span className='mt-2 block text-sm font-medium text-gray-900'>
                        {formData.file
                          ? formData.file.name
                          : "Click to upload or drag and drop"}
                      </span>
                      {formData.file && (
                        <span className='mt-1 block text-sm text-gray-500'>
                          Size: {formatFileSize(formData.file.size)}
                        </span>
                      )}
                      <input
                        id='file'
                        name='file'
                        type='file'
                        className='sr-only'
                        onChange={handleFileChange}
                        accept='.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.ppt,.pptx,.xls,.xlsx'
                        required
                      />
                    </label>
                    <p className='mt-1 text-xs text-gray-500'>
                      PDF, DOC, TXT, Images, PPT, XLS up to 10MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Title *
                  {aiAnalysis && aiAnalysis.title && (
                    <span className='text-xs text-blue-600 ml-2'>
                      <Sparkles className='inline h-3 w-3 mr-1' />
                      AI-suggested
                    </span>
                  )}
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='Enter material title'
                  />
                  {aiAnalysis &&
                    aiAnalysis.title &&
                    formData.title !== aiAnalysis.title && (
                      <button
                        type='button'
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            title: aiAnalysis.title!,
                          }))
                        }
                        className='text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded-md bg-blue-50'
                      >
                        Reset to AI suggestion
                      </button>
                    )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Description
                  {aiAnalysis && (
                    <span className='text-xs text-blue-600 ml-2'>
                      <Sparkles className='inline h-3 w-3 mr-1' />
                      AI-suggested
                    </span>
                  )}
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder={
                    aiLoading
                      ? "Generating AI analysis..."
                      : "Brief description of the material"
                  }
                  disabled={aiLoading}
                />
                {aiAnalysis && (
                  <div className='mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md'>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-sm font-medium text-blue-900'>
                        <Sparkles className='inline h-4 w-4 mr-1' />
                        AI Analysis Complete
                      </span>
                      <button
                        type='button'
                        onClick={() =>
                          setFormData({
                            ...formData,
                            description: aiAnalysis.description,
                          })
                        }
                        className='text-xs text-blue-600 hover:text-blue-800'
                      >
                        Reset to AI suggestion
                      </button>
                    </div>
                    <p className='text-sm text-blue-800 mb-2'>
                      {aiAnalysis.description}
                    </p>
                    <div className='text-xs text-blue-700'>
                      <strong>AI Suggestions:</strong> {aiAnalysis.topic} •{" "}
                      {aiAnalysis.level} • {aiAnalysis.type} •{" "}
                      {aiAnalysis.skill}
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdowns */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* Topic */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Topic *
                    {aiAnalysis && formData.topic === aiAnalysis.topic && (
                      <span className='text-xs text-blue-600 ml-2'>
                        <Sparkles className='inline h-3 w-3 mr-1' />
                        AI-suggested
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={formData.topic}
                    onChange={(e) =>
                      setFormData({ ...formData, topic: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select topic</option>
                    {MATERIAL_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Level *
                    {aiAnalysis && formData.level === aiAnalysis.level && (
                      <span className='text-xs text-blue-600 ml-2'>
                        <Sparkles className='inline h-3 w-3 mr-1' />
                        AI-suggested
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={formData.level}
                    onChange={(e) =>
                      setFormData({ ...formData, level: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select level</option>
                    {MATERIAL_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Type *
                    {aiAnalysis && formData.type === aiAnalysis.type && (
                      <span className='text-xs text-blue-600 ml-2'>
                        <Sparkles className='inline h-3 w-3 mr-1' />
                        AI-suggested
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select type</option>
                    {MATERIAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Skill */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Skill Targeted *
                    {aiAnalysis && formData.skill === aiAnalysis.skill && (
                      <span className='text-xs text-blue-600 ml-2'>
                        <Sparkles className='inline h-3 w-3 mr-1' />
                        AI-suggested
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={formData.skill}
                    onChange={(e) =>
                      setFormData({ ...formData, skill: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select skill</option>
                    {MATERIAL_SKILLS.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Additional Tags */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Additional Tags
                  {aiAnalysis &&
                    formData.tags === aiAnalysis.tags.join(", ") && (
                      <span className='text-xs text-blue-600 ml-2'>
                        <Sparkles className='inline h-3 w-3 mr-1' />
                        AI-suggested
                      </span>
                    )}
                </label>
                <input
                  type='text'
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter tags separated by commas (e.g., beginner, interactive, visual)'
                />
                <p className='mt-1 text-xs text-gray-500'>
                  Optional: Add custom tags to help with AI recommendations
                </p>
              </div>

              {/* Messages */}
              {error && (
                <div className='text-red-600 text-sm bg-red-50 p-3 rounded-md flex items-center gap-2'>
                  <FileText className='h-4 w-4' />
                  {error}
                </div>
              )}

              {success && (
                <div className='text-green-600 text-sm bg-green-50 p-3 rounded-md flex items-center gap-2'>
                  <BookOpen className='h-4 w-4' />
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <div className='flex gap-3'>
                <button
                  type='submit'
                  disabled={loading}
                  className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                >
                  {loading ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className='h-4 w-4' />
                      Upload Material
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Information Panel */}
          <div className='mt-6 bg-blue-50 rounded-lg p-4'>
            <div className='flex items-start gap-3'>
              <Tag className='h-5 w-5 text-blue-600 mt-0.5' />
              <div>
                <h3 className='text-sm font-medium text-blue-900'>
                  AI-Powered Recommendations
                </h3>
                <p className='text-sm text-blue-700 mt-1'>
                  The more detailed your tags and descriptions, the better our
                  AI can recommend this material to students who need it.
                  Consider including difficulty level, learning objectives, and
                  any special requirements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
