import { Tag } from "lucide-react";

export default function InformationPanel() {
  return (
    <div className='mt-6 bg-blue-50 rounded-lg p-4'>
      <div className='flex items-start gap-3'>
        <Tag className='h-5 w-5 text-blue-600 mt-0.5' />
        <div>
          <h3 className='text-sm font-medium text-blue-900'>
            AI-Powered Recommendations
          </h3>
          <p className='text-sm text-blue-700 mt-1'>
            The more detailed your tags and descriptions, the better our AI can
            recommend this material to students who need it. Consider including
            difficulty level, learning objectives, and any special requirements.
          </p>
        </div>
      </div>
    </div>
  );
}
