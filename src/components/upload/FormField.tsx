import { Sparkles } from "lucide-react";
import { AIAnalysisResult } from "@/lib/openai";

interface FormFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  aiAnalysis?: AIAnalysisResult | null;
  aiSuggestionKey?: keyof AIAnalysisResult;
  onResetToAI?: () => void;
  type?: "input" | "textarea";
  rows?: number;
}

export default function FormField({
  label,
  required = false,
  value,
  onChange,
  placeholder,
  disabled = false,
  aiAnalysis,
  aiSuggestionKey,
  onResetToAI,
  type = "input",
  rows = 4,
}: FormFieldProps) {
  const hasAISuggestion =
    aiAnalysis && aiSuggestionKey && aiAnalysis[aiSuggestionKey];
  const isAISuggested =
    hasAISuggestion && value === aiAnalysis[aiSuggestionKey];
  const canResetToAI =
    hasAISuggestion && value !== aiAnalysis[aiSuggestionKey] && onResetToAI;

  return (
    <div>
      <label className='block text-sm font-medium text-gray-700 mb-1'>
        {label} {required && "*"}
        {isAISuggested && (
          <span className='text-xs text-blue-600 ml-2'>
            <Sparkles className='inline h-3 w-3 mr-1' />
            AI-suggested
          </span>
        )}
      </label>
      <div className='flex gap-2'>
        {type === "textarea" ? (
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder={placeholder}
            disabled={disabled}
          />
        ) : (
          <input
            type='text'
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder={placeholder}
            disabled={disabled}
          />
        )}
        {canResetToAI && (
          <button
            type='button'
            onClick={onResetToAI}
            className='text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded-md bg-blue-50'
          >
            Reset to AI suggestion
          </button>
        )}
      </div>
    </div>
  );
}
