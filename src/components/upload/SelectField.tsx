import { Sparkles } from "lucide-react";
import { AIAnalysisResult } from "@/lib/openai";

interface SelectFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  aiAnalysis?: AIAnalysisResult | null;
  aiSuggestionKey?: keyof AIAnalysisResult;
}

export default function SelectField({
  label,
  required = false,
  value,
  onChange,
  options,
  placeholder = "Select option",
  aiAnalysis,
  aiSuggestionKey,
}: SelectFieldProps) {
  const hasAISuggestion =
    aiAnalysis && aiSuggestionKey && aiAnalysis[aiSuggestionKey];
  const isAISuggested =
    hasAISuggestion && value === aiAnalysis[aiSuggestionKey];

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
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
      >
        <option value=''>{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
