import React from 'react';
import { AccentTheme } from '../types/hexa';

interface HexCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: 'outer' | 'inner';
  chamferSize?: number;
  accent?: AccentTheme;
  borderGlowIntensity?: number; // 0-100
  neonGlowIntensity?: number; // 0-100
  onClick?: () => void;
  ariaLabel?: string;
}

const ACCENT_GRADIENTS: Record<AccentTheme, string> = {
  cyan: 'linear-gradient(135deg, rgba(0,223,255,0.92) 0%, rgba(22,119,232,0.85) 38%, rgba(139,77,206,0.85) 74%, rgba(185,61,189,0.92) 100%)',
  blue: 'linear-gradient(135deg, rgba(22,119,232,0.95) 0%, rgba(0,223,255,0.85) 45%, rgba(139,77,206,0.88) 100%)',
  purple: 'linear-gradient(135deg, rgba(139,77,206,0.95) 0%, rgba(185,61,189,0.9) 45%, rgba(0,223,255,0.82) 100%)',
  magenta: 'linear-gradient(135deg, rgba(185,61,189,0.95) 0%, rgba(139,77,206,0.9) 50%, rgba(22,119,232,0.88) 100%)',
};

const ACCENT_SHADOW_COLOR: Record<AccentTheme, string> = {
  cyan: 'rgba(0, 223, 255, VAR)',
  blue: 'rgba(22, 119, 232, VAR)',
  purple: 'rgba(139, 77, 206, VAR)',
  magenta: 'rgba(185, 61, 189, VAR)',
};

export const HexCard: React.FC<HexCardProps> = ({
  children,
  className = '',
  innerClassName = '',
  variant = 'outer',
  chamferSize = 14,
  accent = 'cyan',
  borderGlowIntensity = 75,
  neonGlowIntensity = 65,
  onClick,
  ariaLabel,
}) => {
  const c = chamferSize;
  const innerC = Math.max(4, c - 1);

  const outerClip = `polygon(${c}px 0%, calc(100% - ${c}px) 0%, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0% calc(100% - ${c}px), 0% ${c}px)`;
  const innerClip = `polygon(${innerC}px 0%, calc(100% - ${innerC}px) 0%, 100% ${innerC}px, 100% calc(100% - ${innerC}px), calc(100% - ${innerC}px) 100%, ${innerC}px 100%, 0% calc(100% - ${innerC}px), 0% ${innerC}px)`;

  const borderAlpha = Math.max(0.25, Math.min(1, borderGlowIntensity / 100));
  const glowAlpha = ((neonGlowIntensity / 100) * 0.24).toFixed(3);
  const shadowColor = ACCENT_SHADOW_COLOR[accent].replace('VAR', glowAlpha);

  const bgColor = variant === 'outer' ? '#0A1328' : '#0D1932';

  const content = (
    <div
      className={`relative transition-transform duration-200 ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}
      style={{
        filter: neonGlowIntensity > 10 ? `drop-shadow(0 0 12px ${shadowColor})` : undefined,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        className="w-full h-full p-[1.5px]"
        style={{
          clipPath: outerClip,
          background: ACCENT_GRADIENTS[accent],
          opacity: borderAlpha,
        }}
      >
        <div
          className={`w-full h-full ${innerClassName}`}
          style={{
            clipPath: innerClip,
            backgroundColor: bgColor,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return content;
};

interface HexIconButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  size?: number;
  accent?: AccentTheme;
  ariaLabel: string;
  elevated?: boolean;
  className?: string;
}

export const HexIconButton: React.FC<HexIconButtonProps> = ({
  children,
  onClick,
  size = 48,
  accent = 'cyan',
  ariaLabel,
  elevated = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#00DFFF] ${className}`}
      style={{
        width: size,
        height: size,
        filter: elevated
          ? 'drop-shadow(0 0 14px rgba(0, 223, 255, 0.35)) drop-shadow(0 0 6px rgba(139, 77, 206, 0.35))'
          : 'drop-shadow(0 0 8px rgba(0, 223, 255, 0.22))',
      }}
    >
      <div
        className="w-full h-full p-[1.5px] hex-shape"
        style={{
          background: ACCENT_GRADIENTS[accent],
        }}
      >
        <div className="w-full h-full hex-shape bg-[#0A1328] flex items-center justify-center">
          {children}
        </div>
      </div>
    </button>
  );
};
