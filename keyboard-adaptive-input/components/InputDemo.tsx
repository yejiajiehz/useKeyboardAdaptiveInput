import React, { useRef } from 'react';
import { useKeyboardAdaptiveInput } from '../hooks/useKeyboardAdaptiveInput';

interface InputDemoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const InputDemo: React.FC<InputDemoProps> = ({ label, description, className, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize the hook
  useKeyboardAdaptiveInput(inputRef, {
    estimatedKeyboardHeight: 300,
    safeInputPadding: 20
  });

  return (
    <div className="flex flex-col gap-2 mb-4 p-4 bg-white rounded-lg shadow-sm border border-slate-200">
      <label className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      {description && <p className="text-xs text-slate-500 mb-1">{description}</p>}
      <input
        ref={inputRef}
        type="text"
        className={`w-full px-4 py-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${className || ''}`}
        {...props}
      />
    </div>
  );
};