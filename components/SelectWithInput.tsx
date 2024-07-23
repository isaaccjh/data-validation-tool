import React from 'react';

interface SelectWithInputProps {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  labelStyles?: string;
  inputStyles?: string;
  selectStyles?: string;
}

export const SelectWithInput: React.FC<SelectWithInputProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  labelStyles,
  inputStyles,
}) => {
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="mb-4">
      <label htmlFor={id} className={labelStyles}>
        {label}
      </label>
      <input
        type="text"
        id={id}
        value={value}
        onChange={onChange}
        className={inputStyles}
        list={`${id}-list`}
      />
      <datalist id={`${id}-list`}>
        {filteredOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
};