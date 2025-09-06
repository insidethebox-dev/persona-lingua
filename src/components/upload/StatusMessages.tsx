import { FileText, BookOpen } from "lucide-react";

interface StatusMessagesProps {
  error?: string;
  success?: string;
}

export default function StatusMessages({
  error,
  success,
}: StatusMessagesProps) {
  if (!error && !success) return null;

  return (
    <>
      {error && (
        <div className='text-red-600 text-sm bg-red-50 p-3 rounded-md flex items-center gap-2'>
          <FileText className='h-4 w-4' />
          {error}
        </div>
      )}

      {success && (
        <div className='text-green-600 text-sm bg-green-50 p-3 rounded-md flex items-center gap-2'>
          <BookOpen className='h-4 w-4' />
          {success}
        </div>
      )}
    </>
  );
}
