import React from 'react';

export const CircularProgress = ({ value, maxValue, color, label, subLabel, isPercentage }: any) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(Math.max(value / (maxValue || 100), 0), 1);
  const strokeDashoffset = circumference - percent * circumference;

  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto mb-2 mt-2">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 112">
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="transparent"
          className="text-slate-100 dark:text-light-text-secondary"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="butt"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl md:text-2xl font-bold text-light-text-main dark:text-text-main">
          {label}{isPercentage ? '%' : ''}
        </span>
        {subLabel && <span className="text-[10px] md:text-xs font-medium text-light-text-muted dark:text-text-muted mt-1">{subLabel}</span>}
      </div>
    </div>
  );
};
