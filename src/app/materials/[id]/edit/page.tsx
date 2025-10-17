"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect, useParams, useRouter } from "next/navigation";

import DashboardLayout from "@/components/DashboardLayout";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
import { ApiResponse } from "@/types";
import toast from "react-hot-toast";
import {
  MATERIAL_TOPICS,
  MATERIAL_LEVELS,
  MATERIAL_TYPES,
  MATERIAL_SKILLS,
  MATERIAL_LANGUAGES,
} from "@/constants/materials";

interface Material {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: string;
  type: string;
  skill: string;
  language: string;
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

  // Debug: Log component mounts
  useEffect(() => {
    console.log("EditMaterialPage mounted with materialId:", materialId);
    return () => {
      console.log("EditMaterialPage unmounting");
    };
  }, [materialId]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
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
    language: "",
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
          language: material.language,
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
        language: formData.language,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      console.log("Sending update data:", updateData);

      const response = await fetch(`/api/materials/${materialId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data: ApiResponse = await response.json();

      console.log("API Response:", { status: response.status, data });

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

  const handleDelete = async () => {
    if (deleteConfirmText !== material?.title) {
      toast.error("Please type the exact material title to confirm deletion");
      return;
    }

    setDeleting(true);
    const deleteToast = toast.loading("Deleting material...", {
      style: {
        background: "#ef4444",
        color: "white",
      },
    });

    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: "DELETE",
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        toast.dismiss(deleteToast);
        toast.success("Material deleted successfully!", {
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
        toast.dismiss(deleteToast);
        toast.error(data.error || "Failed to delete material");
        setError(data.error || "Failed to delete material");
      }
    } catch (error) {
      console.error("Error deleting material:", error);
      toast.dismiss(deleteToast);
      toast.error("An error occurred while deleting the material");
      setError("An error occurred while deleting the material");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
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
            <h2 className='text-xl font-semibold text-gray-900'>
              Material not found
            </h2>
            <p className='text-gray-600 mt-2'>
              The material you&apos;re looking for doesn&apos;t exist.
            </p>
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

        <div className='max-w-4xl mx-auto'>
          {/* Edit Form */}
          <div className='bg-white rounded-lg shadow-lg p-8'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* Title */}
              <div>
                <label
                  htmlFor='title'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Title <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  id='title'
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter material title'
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor='description'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Description
                </label>
                <textarea
                  id='description'
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Brief description of the material'
                />
              </div>

              {/* Dropdowns */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* Topic */}
                <div>
                  <label
                    htmlFor='topic'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Topic
                  </label>
                  <select
                    id='topic'
                    value={formData.topic}
                    onChange={(e) =>
                      setFormData({ ...formData, topic: e.target.value })
                    }
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
                  <label
                    htmlFor='level'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Level <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='level'
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
                  <label
                    htmlFor='type'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Type <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='type'
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
                  <label
                    htmlFor='skill'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Skill Targeted <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='skill'
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

                {/* Language */}
                <div>
                  <label
                    htmlFor='language'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Language <span className='text-red-500'>*</span>
                  </label>
                  <select
                    id='language'
                    required
                    value={formData.language}
                    onChange={(e) =>
                      setFormData({ ...formData, language: e.target.value })
                    }
                    className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select language</option>
                    {MATERIAL_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label
                  htmlFor='tags'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Additional Tags
                </label>
                <input
                  type='text'
                  id='tags'
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
                  disabled={submitting || deleting}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={submitting || deleting}
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
                {session?.user?.isAdmin && (
                  <button
                    type='button'
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={submitting || deleting}
                    className='bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                  >
                    <Trash2 className='h-4 w-4' />
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className='fixed inset-0 bg-black/30 backdrop-blur-sm` flex items-center justify-center z-50'>
            <div className='bg-white rounded-lg p-8 max-w-md w-full mx-4'>
              <div className='text-center mb-6'>
                <div className='mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4'>
                  <Trash2 className='h-6 w-6 text-red-600' />
                </div>
                <h3 className='text-lg font-medium text-gray-900 mb-2'>
                  Delete Material
                </h3>
                <p className='text-sm text-gray-500 mb-4'>
                  This action cannot be undone. This will permanently delete the
                  material and all associated data.
                </p>
                <p className='text-sm text-gray-700 mb-4'>
                  To confirm deletion, type the material title: <br />
                  <span className='font-medium bg-gray-100 px-2 py-1 rounded text-xs'>
                    {material?.title}
                  </span>
                </p>
              </div>

              <div className='mb-6'>
                <input
                  type='text'
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type the material title exactly'
                  className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500'
                />
              </div>

              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={deleting}
                  className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== material?.title}
                  className='flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                >
                  {deleting ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='h-4 w-4' />
                      Delete Material
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
