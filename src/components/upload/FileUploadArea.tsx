import { Upload } from "lucide-react";

interface FileUploadAreaProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatFileSize: (bytes: number) => string;
}

export default function FileUploadArea({
  file,
  onFileChange,
  formatFileSize,
}: FileUploadAreaProps) {
  return (
    <div>
      <label className='block text-sm font-medium text-gray-700 mb-2'>
        File *
      </label>
      <div className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors'>
        <Upload className='mx-auto h-12 w-12 text-gray-400' />
        <div className='mt-4'>
          <label htmlFor='file' className='cursor-pointer'>
            <span className='mt-2 block text-sm font-medium text-gray-900'>
              {file ? file.name : "Click to upload or drag and drop"}
            </span>
            {file && (
              <span className='mt-1 block text-sm text-gray-500'>
                Size: {formatFileSize(file.size)}
              </span>
            )}
            <input
              id='file'
              name='file'
              type='file'
              className='sr-only'
              onChange={onFileChange}
              accept='.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.ppt,.pptx,.xls,.xlsx'
              required
            />
          </label>
          <p className='mt-1 text-xs text-gray-500'>
            PDF, DOC, TXT, Images, PPT, XLS up to 10MB
          </p>
        </div>
      </div>
    </div>
  );
}
