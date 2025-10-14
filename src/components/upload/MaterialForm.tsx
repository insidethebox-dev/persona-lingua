import { Upload } from "lucide-react";
import AIAnalysisPanel from "./AIAnalysisPanel";
import FileUploadArea from "./FileUploadArea";
import FormField from "./FormField";
import SelectField from "./SelectField";
import InformationPanel from "./InformationPanel";
import StatusMessages from "./StatusMessages";
import { AIAnalysisResult } from "@/lib/openai";
import {
  MATERIAL_TOPICS,
  MATERIAL_LEVELS,
  MATERIAL_TYPES,
  MATERIAL_SKILLS,
  MATERIAL_LANGUAGES,
} from "@/constants/materials";

interface FormData {
  title: string;
  description: string;
  topic: string;
  level: string;
  type: string;
  skill: string;
  language: string;
  tags: string;
  file: File | null;
}

interface MaterialFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  aiAnalysis: AIAnalysisResult | null;
  aiLoading: boolean;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: React.FormEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatFileSize: (bytes: number) => string;
}

export default function MaterialForm({
  formData,
  setFormData,
  aiAnalysis,
  aiLoading,
  loading,
  error,
  success,
  onSubmit,
  onFileChange,
  formatFileSize,
}: MaterialFormProps) {
  return (
    <div className='bg-white rounded-lg shadow-lg p-8'>
      <form onSubmit={onSubmit} className='space-y-8'>
        {/* AI Analysis Panel */}
        {aiAnalysis && (
          <AIAnalysisPanel
            aiAnalysis={aiAnalysis}
            onResetDescription={() =>
              setFormData({
                ...formData,
                description: aiAnalysis.description,
              })
            }
          />
        )}

        {/* File Upload */}
        <FileUploadArea
          file={formData.file}
          onFileChange={onFileChange}
          formatFileSize={formatFileSize}
        />

        {/* Title */}
        <FormField
          label='Title'
          required
          value={formData.title}
          onChange={(value) => setFormData({ ...formData, title: value })}
          placeholder='Enter material title'
          aiAnalysis={aiAnalysis}
          aiSuggestionKey='title'
          onResetToAI={
            aiAnalysis?.title && formData.title !== aiAnalysis.title
              ? () =>
                  setFormData((prev) => ({ ...prev, title: aiAnalysis.title! }))
              : undefined
          }
        />

        {/* Information Panel */}
        <InformationPanel />

        {/* Description */}
        <FormField
          label='Description'
          type='textarea'
          value={formData.description}
          onChange={(value) => setFormData({ ...formData, description: value })}
          placeholder={
            aiLoading
              ? "Generating AI analysis..."
              : "Brief description of the material"
          }
          disabled={aiLoading}
          aiAnalysis={aiAnalysis}
          aiSuggestionKey='description'
        />

        {/* Dropdowns */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <SelectField
            label='Topic'
            value={formData.topic}
            onChange={(value) => setFormData({ ...formData, topic: value })}
            options={MATERIAL_TOPICS}
            placeholder='Select topic (optional)'
            aiAnalysis={aiAnalysis}
            aiSuggestionKey='topic'
          />

          <SelectField
            label='Level'
            required
            value={formData.level}
            onChange={(value) => setFormData({ ...formData, level: value })}
            options={MATERIAL_LEVELS}
            placeholder='Select level'
            aiAnalysis={aiAnalysis}
            aiSuggestionKey='level'
          />

          <SelectField
            label='Type'
            required
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: value })}
            options={MATERIAL_TYPES}
            placeholder='Select type'
            aiAnalysis={aiAnalysis}
            aiSuggestionKey='type'
          />

          <SelectField
            label='Skill Targeted'
            required
            value={formData.skill}
            onChange={(value) => setFormData({ ...formData, skill: value })}
            options={MATERIAL_SKILLS}
            placeholder='Select skill'
            aiAnalysis={aiAnalysis}
            aiSuggestionKey='skill'
          />

          <SelectField
            label='Language'
            required
            value={formData.language}
            onChange={(value) => setFormData({ ...formData, language: value })}
            options={MATERIAL_LANGUAGES}
            placeholder='Select language'
          />
        </div>

        {/* Additional Tags */}
        <FormField
          label='Additional Tags'
          value={formData.tags}
          onChange={(value) => setFormData({ ...formData, tags: value })}
          placeholder='Enter tags separated by commas (e.g., beginner, interactive, visual)'
          aiAnalysis={aiAnalysis}
          aiSuggestionKey='tags'
        />
        <p className='mt-1 text-xs text-gray-500'>
          Optional: Add custom tags to help with AI recommendations
        </p>

        {/* Status Messages */}
        <StatusMessages error={error} success={success} />

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
  );
}
