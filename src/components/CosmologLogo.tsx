import { useTheme } from '@/hooks/useTheme';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function CosmologLogo({ size = 32, className = '' }: LogoProps) {
  const { theme } = useTheme();
  const stroke = theme === 'dark' ? 'hsl(25, 95%, 53%)' : 'hsl(25, 95%, 53%)';
  const starFill = theme === 'dark' ? 'hsl(25, 95%, 53%)' : 'hsl(25, 95%, 53%)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main circle */}
      <circle cx="50" cy="50" r="42" stroke={stroke} strokeWidth="4" />

      {/* Diagonal band (ring/stripe across the planet) */}
      <path
        d="M20 65 Q35 50 80 35"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* 4-point stars (sparkles) */}
      {/* Top-left star */}
      <path d="M32 30 L34 26 L36 30 L40 32 L36 34 L34 38 L32 34 L28 32 Z" fill={starFill} />
      {/* Top-right star */}
      <path d="M54 24 L55.5 21 L57 24 L60 25.5 L57 27 L55.5 30 L54 27 L51 25.5 Z" fill={starFill} />
      {/* Middle-left small star */}
      <path d="M26 48 L27.5 45 L29 48 L32 49.5 L29 51 L27.5 54 L26 51 L23 49.5 Z" fill={starFill} />

      {/* Bottom stars (below the band) */}
      <path d="M42 58 L44 54 L46 58 L50 60 L46 62 L44 66 L42 62 L38 60 Z" fill={starFill} />
      <path d="M60 52 L61.5 49 L63 52 L66 53.5 L63 55 L61.5 58 L60 55 L57 53.5 Z" fill={starFill} />
      <path d="M52 72 L53.5 69.5 L55 72 L57.5 73.5 L55 75 L53.5 77.5 L52 75 L49.5 73.5 Z" fill={starFill} />

      {/* Small dot */}
      <circle cx="38" cy="70" r="2" fill={starFill} />
    </svg>
  );
}
