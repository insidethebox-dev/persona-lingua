import { Sparkles } from "lucide-react";
import { AIAnalysisResult } from "@/lib/openai";

interface AIAnalysisPanelProps {
  aiAnalysis: AIAnalysisResult;
  onResetDescription: () => void;
}

export default function AIAnalysisPanel({
  aiAnalysis,
  onResetDescription,
}: AIAnalysisPanelProps) {
  return (
    <div className='mt-4 space-y-4'>
      <div className='p-3 bg-blue-50 border border-blue-200 rounded-md'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-sm font-medium text-blue-900'>
            <Sparkles className='inline h-4 w-4 mr-1' />
            AI Analysis Complete
          </span>
          <button
            type='button'
            onClick={onResetDescription}
            className='text-xs text-blue-600 hover:text-blue-800'
          >
            Reset to AI suggestion
          </button>
        </div>
        <p className='text-sm text-blue-800 mb-2'>{aiAnalysis.description}</p>
        <div className='text-xs text-blue-700'>
          <strong>AI Suggestions:</strong> {aiAnalysis.topic} •{" "}
          {aiAnalysis.level} • {aiAnalysis.type} • {aiAnalysis.skill}
        </div>
      </div>
    </div>
  );
}
