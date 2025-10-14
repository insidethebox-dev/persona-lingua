import { Wand2 } from "lucide-react";
import GeneratedFileDisplay from "./GeneratedFileDisplay";

interface FormData {
  title: string;
  description: string;
  topic: string;
  level: string;
  type: string;
  skill: string;
  tags: string;
  file: File | null;
}

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

interface FileGenerationPanelProps {
  formData: FormData;
  generating: boolean;
  generationInstructions: string;
  dyslexiaFriendly: boolean;
  outputLanguage: string;
  onInstructionsChange: (value: string) => void;
  onDyslexiaToggle: (value: boolean) => void;
  onOutputLanguageChange: (value: string) => void;
  onGenerateDocx: () => void;
  generatedFile: GeneratedFile | null;
  onDownload: () => void;
}

export default function FileGenerationPanel({
  formData,
  generating,
  generationInstructions,
  dyslexiaFriendly,
  outputLanguage,
  onInstructionsChange,
  onDyslexiaToggle,
  onOutputLanguageChange,
  onGenerateDocx,
  generatedFile,
  onDownload,
}: FileGenerationPanelProps) {
  const isFormComplete =
    formData.title &&
    formData.topic &&
    formData.level &&
    formData.type &&
    formData.skill;

  return (
    <div className='bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-purple-200'>
      <div className='flex items-center gap-3 mb-6'>
        <div className='p-2 bg-purple-100 rounded-lg'>
          <Wand2 className='h-6 w-6 text-purple-600' />
        </div>
        <div>
          <h3 className='text-lg font-semibold text-purple-900'>
            Generate Similar Material
          </h3>
          <p className='text-sm text-purple-700'>
            Create AI-powered content based on your form
          </p>
        </div>
      </div>

      {/* Dyslexia Toggle */}
      <div className='mb-4'>
        <label className='flex items-center gap-3 cursor-pointer'>
          <div className='relative'>
            <input
              type='checkbox'
              checked={dyslexiaFriendly}
              onChange={(e) => onDyslexiaToggle(e.target.checked)}
              className='sr-only'
            />
            <div
              className={`w-11 h-6 rounded-full transition-colors ${
                dyslexiaFriendly ? "bg-purple-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                  dyslexiaFriendly ? "translate-x-5" : "translate-x-0.5"
                } mt-0.5`}
              ></div>
            </div>
          </div>
          <div className='flex-1'>
            <span className='text-sm font-medium text-purple-900 block'>
              Apply dyslexic-friendly formatting
            </span>
            <span className='text-xs text-purple-600'>
              Uses special font, larger text (14pt), and increased line spacing
            </span>
          </div>
        </label>

        {dyslexiaFriendly && (
          <div className='mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg'>
            <div className='text-xs text-purple-700'>
              <div className='font-medium mb-2'>
                Dyslexic-friendly formatting will be applied:
              </div>
              <div className='grid grid-cols-2 gap-2 text-purple-600'>
                <div className='flex items-center gap-1'>
                  <span className='w-1 h-1 bg-purple-400 rounded-full'></span>
                  <span>Font: OpenDyslexic</span>
                </div>
                <div className='flex items-center gap-1'>
                  <span className='w-1 h-1 bg-purple-400 rounded-full'></span>
                  <span>Size: 14pt</span>
                </div>
                <div className='flex items-center gap-1'>
                  <span className='w-1 h-1 bg-purple-400 rounded-full'></span>
                  <span>Line spacing: 1.5x</span>
                </div>
                <div className='flex items-center gap-1'>
                  <span className='w-1 h-1 bg-purple-400 rounded-full'></span>
                  <span>Letter spacing: +0.5pt</span>
                </div>
              </div>
              <div className='mt-2 text-xs text-purple-500'>
                Research-based formatting to improve readability for dyslexic
                users
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Output Language Selection */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-purple-900 mb-2'>
          Output Language
        </label>
        <select
          value={outputLanguage}
          onChange={(e) => onOutputLanguageChange(e.target.value)}
          className='w-full border border-purple-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm'
        >
          <option value='English'>English</option>
          <option value='Greek'>Greek (Ελληνικά)</option>
          <option value='Spanish'>Spanish (Español)</option>
        </select>
        <p className='text-xs text-purple-600 mt-2'>
          Choose the language for the generated educational material
        </p>
      </div>

      {/* Generation Instructions Field */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-purple-900 mb-2'>
          Special Instructions
        </label>
        <textarea
          value={generationInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          className='w-full border border-purple-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm resize-none'
          placeholder='e.g., "Include more visual examples", "Focus on real-world applications", "Add interactive exercises"...'
          rows={6}
        />
        <p className='text-xs text-purple-600 mt-2'>
          Provide specific guidance for AI content generation
        </p>
      </div>

      {/* Generate Button */}
      <button
        type='button'
        onClick={onGenerateDocx}
        disabled={generating || !isFormComplete}
        className='w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium shadow-lg transition-all'
        title={
          !isFormComplete ? "Please fill in all required fields first" : ""
        }
      >
        {generating ? (
          <>
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
            Generating...
          </>
        ) : (
          <>
            <Wand2 className='h-4 w-4' />
            Generate & Download DOCX
          </>
        )}
      </button>

      {!isFormComplete && (
        <div className='mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700'>
          <div className='flex items-center gap-2'>
            <div className='w-1 h-1 bg-amber-500 rounded-full'></div>
            Complete the form on the left to enable file generation
          </div>
        </div>
      )}

      {/* Generated File Display */}
      {generatedFile && (
        <div className='mt-6'>
          <GeneratedFileDisplay
            generatedFile={generatedFile}
            onDownload={onDownload}
          />
        </div>
      )}
    </div>
  );
}
