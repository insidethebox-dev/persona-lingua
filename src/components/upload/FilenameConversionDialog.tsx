import { useState, useEffect } from "react";
import { AlertTriangle, FileText, X } from "lucide-react";
import { convertFilenameToAscii } from "@/utils/greeklish";

interface FilenameConversionDialogProps {
  isOpen: boolean;
  originalFilename: string;
  onConfirm: (newFilename: string) => void;
  onCancel: () => void;
}

export default function FilenameConversionDialog({
  isOpen,
  originalFilename,
  onConfirm,
  onCancel,
}: FilenameConversionDialogProps) {
  const conversionResult = convertFilenameToAscii(originalFilename);
  const [customFilename, setCustomFilename] = useState(
    conversionResult.convertedName
  );

  // Update the filename when originalFilename changes or dialog opens
  useEffect(() => {
    if (isOpen && originalFilename) {
      const result = convertFilenameToAscii(originalFilename);
      setCustomFilename(result.convertedName);
    }
  }, [isOpen, originalFilename]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(customFilename.trim() || conversionResult.convertedName);
  };

  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b'>
          <div className='flex items-center space-x-3'>
            <AlertTriangle className='h-6 w-6 text-amber-500' />
            <h2 className='text-xl font-semibold text-gray-900'>
              Filename Conversion Required
            </h2>
          </div>
          <button
            onClick={onCancel}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            <X className='h-6 w-6' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6 space-y-6'>
          {/* Explanation */}
          <div className='bg-amber-50 border border-amber-200 rounded-lg p-4'>
            <div className='flex items-start space-x-3'>
              <FileText className='h-5 w-5 text-amber-600 mt-0.5' />
              <div>
                <h3 className='font-medium text-amber-800 mb-1'>
                  Non-ASCII Characters Detected
                </h3>
                <p className='text-sm text-amber-700'>
                  Your filename contains{" "}
                  {conversionResult.originalHadGreek ? "Greek" : "special"}{" "}
                  characters that need to be converted to ASCII for
                  compatibility with our file storage system.
                </p>
              </div>
            </div>
          </div>

          {/* Original vs Converted */}
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Original Filename:
              </label>
              <div className='bg-gray-50 p-3 rounded-lg border'>
                <code className='text-sm text-gray-900'>
                  {originalFilename}
                </code>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Converted Filename:{" "}
              </label>

              {/* Editable field */}
              <div className='flex space-x-2'>
                <input
                  type='text'
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className='flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Edit the filename if needed'
                />
                <button
                  type='button'
                  onClick={() =>
                    setCustomFilename(conversionResult.convertedName)
                  }
                  className='px-3 py-2 text-sm bg-green-100 text-green-700 border border-green-300 rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap'
                >
                  Use Auto
                </button>
              </div>
              <p className='mt-2 text-xs text-gray-500'>
                The filename was automatically converted from Greek to
                Greeklish. You can edit it manually or click &ldquo;Use
                Auto&rdquo; to restore the automatic conversion.
              </p>
            </div>
          </div>

          {/* Conversion Details */}
          {conversionResult.originalHadGreek && (
            <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
              <h4 className='font-medium text-blue-800 mb-2'>
                Greek → Greeklish Conversion
              </h4>
              <p className='text-sm text-blue-700'>
                Greek characters have been converted to their Latin alphabet
                equivalents (Greeklish) to ensure compatibility across all
                systems.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end space-x-3 p-6 border-t bg-gray-50'>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
          >
            Cancel Upload
          </button>
          <button
            onClick={handleConfirm}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Continue with Converted Name
          </button>
        </div>
      </div>
    </div>
  );
}
