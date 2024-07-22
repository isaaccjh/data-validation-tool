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
    <div >
      <p>Success Percentage: {result.success_percentage}%</p>
      {Object.keys(result.errors).length > 0 ? (
        <ul>
          {Object.entries(result.errors).map(([fileName, errorDetails]) => (
            <li key={fileName}>
              {fileName}: {errorDetails.signal_message}
            </li>
          ))}
        </ul>
      ) : (
        <p>No errors found.</p>
      )}
    </div>
  );
};