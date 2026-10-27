import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * A lens wrapped around a play control — "see execution, frame by frame".
 * Drawn as inline SVG so it inherits the current theme.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 36, className }) => (
  <div
    className={`brand-mark${className ? ` ${className}` : ''}`}
    style={{ width: size, height: size }}
    aria-hidden='true'
  >
    <svg width={size * 0.64} height={size * 0.64} viewBox='0 0 24 24' fill='none'>
      <circle cx='10.2' cy='10.2' r='6.1' stroke='currentColor' strokeWidth='2.1' />
      <path d='M8.9 7.3 L13.3 10.2 L8.9 13.1 Z' fill='currentColor' />
      <path
        d='M14.9 14.9 L20.3 20.3'
        stroke='currentColor'
        strokeWidth='2.4'
        strokeLinecap='round'
      />
    </svg>
  </div>
);

export default BrandMark;
