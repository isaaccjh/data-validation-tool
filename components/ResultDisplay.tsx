import React from 'react';
import "../src/index.css"

interface ResultDisplayProps {
  result: {
    success_percentage: number;
    errors: {
      [key: string]: {
        signal_message: string;
      };
    };
  } | null;
  styles: { [key: string]: string };
}


export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, styles }) => {
  if (!result) return null;

  return (
    <div className={styles.div}>
      <h2 className={styles.h2}>Result</h2>
      <p className={styles.p}>Success Percentage: <span className={styles.success}>{result.success_percentage}%</span></p>
      {Object.keys(result.errors).length > 0 ? (
        <div>
          <h3 className={styles.h3}>Errors:</h3>
          <ul className={styles.ul + " " +styles.error}>
            {Object.entries(result.errors).map(([fileName, errorDetails]) => (
              <li key={fileName} className={styles.li}>
                <span className={styles.signalMessage}>{fileName}</span>: {errorDetails.signal_message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.noErrors}>No errors found.</p>
      )}
    </div>
  );
};
