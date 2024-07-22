import React from 'react';

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  labelStyles: string;
  inputStyles: string;
}

export const TextInput: React.FC<TextInputProps> = ({ id, label, value, onChange, inputStyles, labelStyles }) => (
  <div>
    <label className={labelStyles}>{label}</label>
    <input
      type="text"
      id={id}
      value={value}
      onChange={onChange}
      className={inputStyles}
      required
    />
  </div>
);
