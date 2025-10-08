"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MaterialForm, FileGenerationPanel } from "@/components/upload";
import { ApiResponse } from "@/types";
import { AIAnalysisResult } from "@/lib/openai";
import toast from "react-hot-toast";

interface GeneratedFile {
  content: string;
  filename: string;
  analysis: {
    topic: string;
    level: string;
    type: string;
    skill: string;
    generatedTitle: string;
  };
}

export default function UploadPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [generationInstructions, setGenerationInstructions] = useState("");
  const [dyslexiaFriendly, setDyslexiaFriendly] = useState(false);
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

  // Show welcome toast on component mount
  useEffect(() => {
    const toastId = toast(
      (t) => (
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0'>
            <div className='w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs'>
              ⭐
            </div>
          </div>
          <div className='flex-1'>
            <h4 className='font-semibold text-sm text-white'>
              Try AI Generation!
            </h4>
            <p className='text-xs mt-1 text-white'>
              Test the AI generation feature before submitting your uploaded
              file. Fill in the form fields and use the generation panel on the
              right.
            </p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className='flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-2'
          >
            ✕
          </button>
        </div>
      ),
      {
        duration: 15000,
        position: "bottom-right",
        style: {
          background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
          color: "white",
          maxWidth: "400px",
          padding: "16px",
        },
      }
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, []);

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
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("File size must be less than 2MB");
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

  const downloadGeneratedFile = () => {
    if (!generatedFile) return;

    const blob = new Blob([generatedFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generatedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadGeneratedDocx = async () => {
    // Validate required fields first
    if (
      !formData.title ||
      !formData.level ||
      !formData.type ||
      !formData.skill
    ) {
      toast.error(
        "Please fill in all required fields before generating a DOCX file"
      );
      return;
    }

    setGenerating(true);
    setError("");

    // Show loading toast
    const loadingToast = toast.loading("Generating your DOCX file...", {
      style: {
        background: "#3b82f6",
        color: "white",
      },
    });

    try {
      const generateFormData = new FormData();
      // Send the current form data instead of re-analyzing the file
      generateFormData.append("title", formData.title);
      generateFormData.append("description", formData.description);
      generateFormData.append("topic", formData.topic);
      generateFormData.append("level", formData.level);
      generateFormData.append("type", formData.type);
      generateFormData.append("skill", formData.skill);
      generateFormData.append("tags", formData.tags);
      generateFormData.append("output", "docx"); // Request DOCX format

      // Include the uploaded file for AI context
      if (formData.file) {
        generateFormData.append("file", formData.file);
      }

      // Add dyslexia instructions if toggle is enabled
      let finalInstructions = generationInstructions;
      if (dyslexiaFriendly) {
        const dyslexiaText = `You are an assistant that rewrites text into a dyslexia-friendly format.
When rewriting, follow these rules:
•  Use short, clear sentences.
•  Prefer simple, common words over complex ones.
•  Break long text into smaller chunks or bullet points.
•  Keep paragraphs short (2–3 sentences maximum).
•  Use headings and subheadings when appropriate.
•  Do not change the meaning of the original text.
•  Avoid double negatives and confusing phrasing.
•  Make sure the rewritten version is easier to read and scan.

Rewrite the following text accordingly:
`;
        finalInstructions = finalInstructions
          ? `${dyslexiaText}\n\n${finalInstructions}`
          : dyslexiaText;
      }

      generateFormData.append("instructions", finalInstructions);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        body: generateFormData,
      });

      if (response.ok) {
        // Handle DOCX download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "generated-material.docx";
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="([^"]+)"/);
          if (match) {
            filename = match[1];
          }
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success(`DOCX file "${filename}" downloaded successfully!`, {
          duration: 4000,
          style: {
            background: "#10b981",
            color: "white",
          },
        });
      } else {
        const errorData = await response.json();
        toast.dismiss(loadingToast);
        toast.error(errorData.error || "Failed to generate DOCX file");
        setError(errorData.error || "Failed to generate DOCX file");
      }
    } catch (error) {
      console.error("Error generating DOCX file:", error);
      toast.dismiss(loadingToast);
      toast.error("An error occurred while generating the DOCX file");
      setError("An error occurred while generating the DOCX file");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.file) {
      toast.error("Please select a file to upload");
      setError("Please select a file to upload");
      setLoading(false);
      return;
    }

    // Show loading toast
    const uploadToast = toast.loading("Uploading your learning material...", {
      style: {
        background: "#8b5cf6",
        color: "white",
      },
    });

    try {
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
        setGeneratedFile(null);
        setGenerationInstructions("");
        setDyslexiaFriendly(false);
        // Reset file input
        const fileInput = document.getElementById("file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        toast.dismiss(uploadToast);
        toast.success("Material uploaded successfully!", {
          duration: 4000,
          style: {
            background: "#10b981",
            color: "white",
          },
        });
      } else {
        toast.dismiss(uploadToast);
        toast.error(data.error || "Failed to upload material");
        setError(data.error || "Failed to upload material");
      }
    } catch (error) {
      console.error("Error uploading material:", error);
      toast.dismiss(uploadToast);
      toast.error("An error occurred while uploading the material");
      setError("An error occurred while uploading the material");
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
        </div>{" "}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Column - Main Form */}
          <div className='lg:col-span-2'>
            <MaterialForm
              formData={formData}
              setFormData={setFormData}
              aiAnalysis={aiAnalysis}
              aiLoading={aiLoading}
              loading={loading}
              error={error}
              success={success}
              onSubmit={handleSubmit}
              onFileChange={handleFileChange}
              formatFileSize={formatFileSize}
            />
          </div>

          {/* Right Column - File Generation */}
          <div className='lg:col-span-1'>
            <FileGenerationPanel
              formData={formData}
              generating={generating}
              generationInstructions={generationInstructions}
              dyslexiaFriendly={dyslexiaFriendly}
              onInstructionsChange={setGenerationInstructions}
              onDyslexiaToggle={setDyslexiaFriendly}
              onGenerateDocx={downloadGeneratedDocx}
              generatedFile={generatedFile}
              onDownload={downloadGeneratedFile}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
