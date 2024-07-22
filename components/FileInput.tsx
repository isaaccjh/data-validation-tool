import React from 'react';
import "../src/index.css"

interface FileInputProps {
  id: string;
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
  labelStyles: string;
  inputStyles: string;
}

export const FileInput: React.FC<FileInputProps> = ({ id, label, onChange, accept, labelStyles, inputStyles }) => (
  <div>
    <label className={labelStyles}>{label}</label>
    <input
      className={inputStyles}
      type="file"
      id={id}
      onChange={onChange}
      accept={accept}
      required
    />
  </div>
);
