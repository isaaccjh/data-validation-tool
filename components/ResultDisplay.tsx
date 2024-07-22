import React from 'react';

interface ResultDisplayProps {
  result: {
    success_percentage: number;
    errors: {
      [key: string]: {
        signal_message: string;
      };
    };
  } | null;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  if (!result) return null;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">Result</h2>
      <p className="text-lg font-semibold mb-4">Success Percentage: <span className="text-green-600">{result.success_percentage}%</span></p>
      {Object.keys(result.errors).length > 0 ? (
        <div>
          <h3 className="text-xl font-semibold mb-2">Errors:</h3>
          <ul className="list-disc list-inside text-red-600">
            {Object.entries(result.errors).map(([fileName, errorDetails]) => (
              <li key={fileName} className="mb-2">
                <span className="font-medium">{fileName}</span>: {errorDetails.signal_message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-lg font-semibold text-green-600">No errors found.</p>
      )}
    </div>
  );
};
