import React from 'react';

/**
 * Yellow Cab iconic license plate logo badge based on official logo specifications
 */
export const YellowCabPlateLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-xl',
  };

  const titleSizes = {
    sm: 'text-sm font-black leading-none tracking-tight',
    md: 'text-lg font-black leading-none tracking-tight',
    lg: 'text-2xl font-black leading-none tracking-tight',
    xl: 'text-4xl font-black leading-none tracking-tight',
  };

  const subtitleSizes = {
    sm: 'text-[9px] font-bold leading-none tracking-wider mt-0.5',
    md: 'text-xs font-bold leading-none tracking-wider mt-1',
    lg: 'text-sm font-bold leading-none tracking-wider mt-1',
    xl: 'text-lg font-bold leading-none tracking-wider mt-1.5',
  };

  return (
    <div
      className={`inline-flex flex-col items-center justify-center bg-amber-400 text-zinc-950 rounded-xl border-2 border-zinc-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] select-none relative ${sizeClasses[size]} ${className}`}
    >
      <span className="absolute top-0.5 right-1 text-[8px] font-bold text-zinc-900 leading-none">
        ®
      </span>
      <span className={`font-mono uppercase text-zinc-950 ${titleSizes[size]}`} style={{ fontFamily: 'Impact, "Arial Black", sans-serif', transform: 'scaleY(1.15)' }}>
        YELLOW CAB
      </span>
      <span className={`text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] ${subtitleSizes[size]}`} style={{ fontFamily: 'sans-serif' }}>
        Pizza Co.
      </span>
    </div>
  );
};

/**
 * Iconic Yellow Cab Black & Yellow Checkerboard Stripe Banner
 */
export const YellowCabCheckerboard: React.FC<{ height?: string; className?: string }> = ({
  height = 'h-4',
  className = '',
}) => {
  return (
    <div
      className={`w-full overflow-hidden border-y border-zinc-950 shadow-xs ${height} ${className}`}
      style={{
        backgroundImage: `repeating-conic-gradient(#f59e0b 0% 25%, #18181b 0% 50%)`,
        backgroundSize: '16px 16px',
      }}
      aria-hidden="true"
    />
  );
};
