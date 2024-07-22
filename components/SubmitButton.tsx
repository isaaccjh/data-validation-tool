import React from "react";

interface SubmitButtonProps {
  label: string;
  styles: string;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({ label, styles }) => (
  <>
    <button type="submit" className={styles}>
      {label}
    </button>
  </>
);
