"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
  FileText,
  Download,
  Calendar,
  Tag,
  BookOpen,
  Users,
  Filter,
  Edit3,
} from "lucide-react";
import { ApiResponse } from "@/types";
import { formatDate, formatFileSize } from "@/lib/utils";
import toast from "react-hot-toast";

interface Material {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  size: number;
  fileUrl: string | null;
  topic: string | null; // Made optional
  level: string;
  type: string;
  skill: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  teacher?: {
    name: string;
    email: string;
    subject: string | null;
  };
  school?: {
    name: string;
  };
}

export default function MaterialsPage() {
  const { data: session, status } = useSession();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    topic: "",
    level: "",
    type: "",
    skill: "",
    search: "",
  });

  // Debug: Track component renders
  useEffect(() => {
    console.log('MaterialsPage rendered, materials count:', materials.length);
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    filterMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, filters]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch("/api/materials");
      const data: ApiResponse<Material[]> = await response.json();

      if (data.success && data.data) {
        setMaterials(data.data);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterMaterials = () => {
    let filtered = materials;

    if (filters.search) {
      filtered = filtered.filter(
        (material) =>
          material.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          material.description
            ?.toLowerCase()
            .includes(filters.search.toLowerCase()) ||
          material.tags.some((tag) =>
            tag.toLowerCase().includes(filters.search.toLowerCase())
          )
      );
    }

    if (filters.topic) {
      filtered = filtered.filter(
        (material) => material.topic === filters.topic
      );
    }

    if (filters.level) {
      filtered = filtered.filter(
        (material) => material.level === filters.level
      );
    }

    if (filters.type) {
      filtered = filtered.filter((material) => material.type === filters.type);
    }

    if (filters.skill) {
      filtered = filtered.filter(
        (material) => material.skill === filters.skill
      );
    }

    setFilteredMaterials(filtered);
  };

  const clearFilters = () => {
    setFilters({
      topic: "",
      level: "",
      type: "",
      skill: "",
      search: "",
    });
  };

  const getUniqueValues = (key: keyof Material) => {
    return Array.from(
      new Set(materials.map((material) => material[key] as string))
    ).filter(Boolean);
  };

  const handleDownload = useCallback(async (material: Material) => {
    console.log('handleDownload called for:', material.id, 'Already downloading:', downloadingIds.has(material.id));
    
    // Check if already downloading this material
    if (downloadingIds.has(material.id)) {
      console.log('Download blocked - already in progress for:', material.id);
      return;
    }

    // Add to downloading set
    setDownloadingIds(prev => {
      const newSet = new Set(prev);
      newSet.add(material.id);
      console.log('Added to downloading set:', material.id, 'Set size:', newSet.size);
      return newSet;
    });

    try {
      // The API now directly streams the file with proper filename
      const downloadUrl = `/api/materials/download?id=${material.id}`;
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = material.filename || material.title || "download";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download started!', { duration: 2000 });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Unable to download file. Opening original link instead.");
      if (material.fileUrl) {
        window.open(material.fileUrl, "_blank", "noopener");
      }
    } finally {
      // Remove from downloading set after a delay
      setTimeout(() => {
        setDownloadingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(material.id);
          return newSet;
        });
      }, 3000);
    }
  }, [downloadingIds]);

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

  return (
    <DashboardLayout>
      <div className='p-8'>
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>
              Learning Materials
            </h1>
            <p className='text-gray-600 mt-2'>
              Browse and manage uploaded learning materials
            </p>
          </div>
          <div className='flex items-center gap-4'>
            <div className='text-sm text-gray-500'>
              {filteredMaterials.length} of {materials.length} materials
            </div>
            <a
              href='/upload'
              className='inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'
            >
              <FileText className='h-4 w-4' />
              Upload Material
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className='bg-white rounded-lg shadow p-6 mb-6'>
          <div className='flex items-center gap-2 mb-4'>
            <Filter className='h-5 w-5 text-gray-400' />
            <h2 className='text-lg font-medium text-gray-900'>Filters</h2>
            {(filters.topic ||
              filters.level ||
              filters.type ||
              filters.skill ||
              filters.search) && (
              <button
                onClick={clearFilters}
                className='ml-auto text-sm text-blue-600 hover:text-blue-700'
              >
                Clear all
              </button>
            )}
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {/* Search */}
            <div>
              <input
                type='text'
                placeholder='Search materials...'
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* Topic Filter */}
            <div>
              <select
                value={filters.topic}
                onChange={(e) =>
                  setFilters({ ...filters, topic: e.target.value })
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>All Topics</option>
                {getUniqueValues("topic").map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div>
              <select
                value={filters.level}
                onChange={(e) =>
                  setFilters({ ...filters, level: e.target.value })
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>All Levels</option>
                {getUniqueValues("level").map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters({ ...filters, type: e.target.value })
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>All Types</option>
                {getUniqueValues("type").map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Skill Filter */}
            <div>
              <select
                value={filters.skill}
                onChange={(e) =>
                  setFilters({ ...filters, skill: e.target.value })
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>All Skills</option>
                {getUniqueValues("skill").map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Materials Grid */}
        {filteredMaterials.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {filteredMaterials.map((material) => (
              <div
                key={material.id}
                className='bg-white rounded-lg shadow hover:shadow-md transition-shadow'
              >
                <div className='p-6'>
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex items-center gap-3'>
                      <div className='bg-blue-100 p-2 rounded-full'>
                        <FileText className='h-5 w-5 text-blue-600' />
                      </div>
                      <div className='flex-1 min-w-0'>
                        <h3 className='font-medium text-gray-900 truncate'>
                          {material.title}
                        </h3>
                        <p className='text-sm text-gray-500'>
                          {formatFileSize(material.size)}
                        </p>
                      </div>
                    </div>
                    <div className='flex gap-1'>
                      {session?.user?.isAdmin && (
                        <button
                          onClick={() =>
                            (window.location.href = `/materials/${material.id}/edit`)
                          }
                          className='p-2 text-gray-400 hover:text-green-600 transition-colors'
                          title='Edit'
                        >
                          <Edit3 className='h-4 w-4' />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDownload(material);
                        }}
                        disabled={downloadingIds.has(material.id)}
                        className={`p-2 transition-colors ${
                          downloadingIds.has(material.id)
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-blue-600'
                        }`}
                        title={downloadingIds.has(material.id) ? 'Downloading...' : 'Download'}
                      >
                        <Download className={`h-4 w-4 ${
                          downloadingIds.has(material.id) ? 'animate-bounce' : ''
                        }`} />
                      </button>
                    </div>
                  </div>

                  {material.description && (
                    <p className='text-sm text-gray-600 mb-4 line-clamp-2'>
                      {material.description}
                    </p>
                  )}

                  <div className='space-y-3'>
                    <div className='grid grid-cols-2 gap-3 text-xs'>
                      <div className='flex items-center gap-1 text-gray-600'>
                        <BookOpen className='h-3 w-3' />
                        <span>{material.topic || "No topic specified"}</span>
                      </div>
                      <div className='flex items-center gap-1 text-gray-600'>
                        <Users className='h-3 w-3' />
                        <span>{material.level}</span>
                      </div>
                    </div>

                    <div className='grid grid-cols-2 gap-3 text-xs'>
                      <div className='text-gray-600'>
                        <span className='font-medium'>Type:</span>{" "}
                        {material.type}
                      </div>
                      <div className='text-gray-600'>
                        <span className='font-medium'>Skill:</span>{" "}
                        {material.skill}
                      </div>
                    </div>

                    {material.tags.length > 0 && (
                      <div className='flex items-center gap-1 flex-wrap'>
                        <Tag className='h-3 w-3 text-gray-400' />
                        {material.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className='inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded'
                          >
                            {tag}
                          </span>
                        ))}
                        {material.tags.length > 3 && (
                          <span className='text-xs text-gray-500'>
                            +{material.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className='space-y-1 pt-2 border-t'>
                      <div className='flex items-center gap-1 text-xs text-gray-500'>
                        <Calendar className='h-3 w-3' />
                        <span>Uploaded {formatDate(material.createdAt)}</span>
                      </div>
                      {material.teacher && (
                        <div className='flex items-center gap-1 text-xs text-gray-500'>
                          <Users className='h-3 w-3' />
                          <span>By {material.teacher.name}</span>
                          {material.teacher.subject && (
                            <span className='text-gray-400'>
                              ({material.teacher.subject})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <FileText className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900'>
              {materials.length === 0
                ? "No materials yet"
                : "No materials match your filters"}
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              {materials.length === 0
                ? "Get started by uploading your first learning material."
                : "Try adjusting your search criteria or clearing the filters."}
            </p>
            {materials.length === 0 && (
              <div className='mt-6'>
                <a
                  href='/upload'
                  className='inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
                >
                  <FileText className='h-4 w-4' />
                  Upload Material
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
