"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect, useParams, useRouter } from "next/navigation";

import DashboardLayout from "@/components/DashboardLayout";
import { Save, ArrowLeft, Download, FileText, Image as ImageIcon } from "lucide-react";
import { ApiResponse } from "@/types";
import toast from "react-hot-toast";
import {
  MATERIAL_TOPICS,
  MATERIAL_LEVELS,
  MATERIAL_TYPES,
  MATERIAL_SKILLS,
} from "@/constants/materials";

interface Material {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: string;
  type: string;
  skill: string;
  tags: string[];
  filename: string;
  mimeType: string;
  size: number;
  fileUrl: string | null;
}

export default function EditMaterialPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const materialId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [material, setMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    topic: "",
    level: "",
    type: "",
    skill: "",
    tags: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
    if (status === "authenticated" && !session?.user?.isAdmin) {
      redirect("/materials");
    }
  }, [status, session]);

  const fetchMaterial = useCallback(async () => {
    try {
      const response = await fetch(`/api/materials/${materialId}`);
      const data: ApiResponse<Material> = await response.json();

      if (data.success && data.data) {
        const material = data.data;
        setMaterial(material);
        setFormData({
          title: material.title,
          description: material.description || "",
          topic: material.topic || "",
          level: material.level,
          type: material.type,
          skill: material.skill,
          tags: material.tags.join(", "),
        });
      } else {
        setError("Material not found");
        toast.error("Material not found");
      }
    } catch (error) {
      console.error("Error fetching material:", error);
      setError("Failed to load material");
      toast.error("Failed to load material");
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    if (materialId && status === "authenticated") {
      fetchMaterial();
    }
  }, [materialId, status, fetchMaterial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    // Show loading toast
    const updateToast = toast.loading("Updating material...", {
      style: {
        background: "#8b5cf6",
        color: "white",
      },
    });

    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        topic: formData.topic || null,
        level: formData.level,
        type: formData.type,
        skill: formData.skill,
        tags: formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      };

      const response = await fetch(`/api/materials/${materialId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setSuccess("Material updated successfully!");
        toast.dismiss(updateToast);
        toast.success("Material updated successfully!", {
          duration: 4000,
          style: {
            background: "#10b981",
            color: "white",
          },
        });
        
        // Redirect back to materials page after a short delay
        setTimeout(() => {
          router.push("/materials");
        }, 1500);
      } else {
        toast.dismiss(updateToast);
        toast.error(data.error || "Failed to update material");
        setError(data.error || "Failed to update material");
      }
    } catch (error) {
      console.error("Error updating material:", error);
      toast.dismiss(updateToast);
      toast.error("An error occurred while updating the material");
      setError("An error occurred while updating the material");
    } finally {
      setSubmitting(false);
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

  if (!material) {
    return (
      <DashboardLayout>
        <div className='p-8'>
          <div className='text-center py-12'>
            <h2 className='text-xl font-semibold text-gray-900'>Material not found</h2>
            <p className='text-gray-600 mt-2'>The material you&apos;re looking for doesn&apos;t exist.</p>
            <button
              onClick={() => router.push("/materials")}
              className='mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
            >
              <ArrowLeft className='h-4 w-4' />
              Back to Materials
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className='p-8'>
        <div className='mb-8'>
          <div className='flex items-center gap-4 mb-4'>
            <button
              onClick={() => router.push("/materials")}
              className='p-2 text-gray-400 hover:text-gray-600 transition-colors'
              title='Back to Materials'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>
                Edit Material
              </h1>
              <p className='text-gray-600 mt-2'>
                Update the material information
              </p>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Column - Edit Form */}
          <div className='lg:col-span-2'>
            <div className='bg-white rounded-lg shadow-lg p-8'>
              <form onSubmit={handleSubmit} className='space-y-6'>
              {/* Title */}
              <div>
                <label htmlFor='title' className='block text-sm font-medium text-gray-700 mb-2'>
                  Title <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  id='title'
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter material title'
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor='description' className='block text-sm font-medium text-gray-700 mb-2'>
                  Description
                </label>
                <textarea
                  id='description'
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Brief description of the material'
                />
              </div>

              {/* Dropdowns */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* Topic */}
                <div>
                  <label htmlFor='topic' className='block text-sm font-medium text-gray-700 mb-2'>
                    Topic
                  </label>
                  <select
                    id='topic'
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select topic (optional)</option>
                    {MATERIAL_TOPICS.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level */}
                <div>
                  <label htmlFor='level' className='block text-sm font-medium text-gray-700 mb-2'>
                    Level <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='level'
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
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
                  <label htmlFor='type' className='block text-sm font-medium text-gray-700 mb-2'>
                    Type <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='type'
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                  <label htmlFor='skill' className='block text-sm font-medium text-gray-700 mb-2'>
                    Skill Targeted <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='skill'
                    required
                    value={formData.skill}
                    onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
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

              {/* Tags */}
              <div>
                <label htmlFor='tags' className='block text-sm font-medium text-gray-700 mb-2'>
                  Additional Tags
                </label>
                <input
                  type='text'
                  id='tags'
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter tags separated by commas (e.g., beginner, interactive, visual)'
                />
                <p className='mt-1 text-xs text-gray-500'>
                  Optional: Add custom tags to help with AI recommendations
                </p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded'>
                  {error}
                </div>
              )}
              {success && (
                <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded'>
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={() => router.push("/materials")}
                  className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                >
                  {submitting ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className='h-4 w-4' />
                      Update Material
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - File Preview */}
        <div className='lg:col-span-1'>
          <div className='bg-white rounded-lg shadow-lg p-6'>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>File Preview</h3>
            
            {material?.fileUrl ? (
              <div className='space-y-4'>
                {/* File Info */}
                <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
                  <div className='bg-blue-100 p-2 rounded-full'>
                    {material.mimeType.startsWith('image/') ? (
                      <ImageIcon className='h-5 w-5 text-blue-600' />
                    ) : (
                      <FileText className='h-5 w-5 text-blue-600' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-gray-900 truncate'>
                      {material.filename}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {material.mimeType} • {Math.round(material.size / 1024)} KB
                    </p>
                  </div>
                </div>

                {/* Preview Section */}
                {material.mimeType.startsWith('image/') ? (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-gray-700'>Image Preview:</p>
                    <div className='border border-gray-200 rounded-lg overflow-hidden'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={material.fileUrl}
                        alt={material.title}
                        className='w-full h-auto max-h-64 object-contain bg-gray-50'
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="flex items-center justify-center h-32 bg-gray-100 text-gray-500">
                                <div class="text-center">
                                  <FileText class="h-8 w-8 mx-auto mb-2" />
                                  <p class="text-sm">Preview not available</p>
                                </div>
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : material.mimeType === 'application/pdf' ? (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-gray-700'>PDF Preview:</p>
                    <div className='border border-gray-200 rounded-lg overflow-hidden h-64'>
                      <iframe
                        src={`${material.fileUrl}#view=FitH`}
                        className='w-full h-full'
                        title={`Preview of ${material.filename}`}
                        onError={() => {
                          console.log('PDF preview failed');
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-gray-700'>File Type:</p>
                    <div className='flex items-center justify-center h-32 bg-gray-50 border border-gray-200 rounded-lg'>
                      <div className='text-center'>
                        <FileText className='h-8 w-8 mx-auto mb-2 text-gray-400' />
                        <p className='text-sm text-gray-600'>Preview not available</p>
                        <p className='text-xs text-gray-500'>
                          {material.mimeType.split('/')[1].toUpperCase()} file
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <button
                  onClick={() => {
                    if (material.fileUrl) {
                      const link = document.createElement('a');
                      link.href = `/api/materials/download?url=${encodeURIComponent(
                        material.fileUrl
                      )}&filename=${encodeURIComponent(material.filename)}`;
                      link.download = material.filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  className='w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2'
                >
                  <Download className='h-4 w-4' />
                  Download File
                </button>
              </div>
            ) : (
              <div className='text-center py-8'>
                <FileText className='mx-auto h-12 w-12 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>
                  No file available
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  This material doesn&apos;t have an associated file.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}