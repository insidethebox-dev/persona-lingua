import { Download } from "lucide-react";

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

interface GeneratedFileDisplayProps {
  generatedFile: GeneratedFile;
  onDownload: () => void;
}

export default function GeneratedFileDisplay({
  generatedFile,
  onDownload,
}: GeneratedFileDisplayProps) {
  return (
    <div className='p-4 bg-white border border-purple-200 rounded-lg shadow-sm'>
      <div className='flex items-start justify-between mb-3'>
        <div>
          <h4 className='text-sm font-semibold text-purple-900 leading-tight'>
            {generatedFile.analysis.generatedTitle}
          </h4>
          <div className='text-xs text-purple-700 mt-1'>
            <span className='font-medium'>Topic:</span>{" "}
            {generatedFile.analysis.topic} •
            <span className='font-medium'> Level:</span>{" "}
            {generatedFile.analysis.level} •
            <span className='font-medium'> Type:</span>{" "}
            {generatedFile.analysis.type}
          </div>
        </div>
        <button
          type='button'
          onClick={onDownload}
          className='flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 bg-purple-100 hover:bg-purple-200 px-3 py-2 rounded-lg transition-colors'
        >
          <Download className='h-3 w-3' />
          Download
        </button>
      </div>
      <div className='max-h-40 overflow-y-auto text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border'>
        {generatedFile.content.length > 300
          ? `${generatedFile.content.substring(0, 300)}...`
          : generatedFile.content}
      </div>
    </div>
  );
}
