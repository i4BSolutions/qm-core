import { Svg, Path, Circle } from "@react-pdf/renderer";

// Placeholder QM logo - easy to swap later with real logo
// Simple shield/badge design with amber accent color
export function PDFLogo() {
  return (
    <Svg width="40" height="40" viewBox="0 0 40 40">
      {/* Shield/badge background */}
      <Path
        d="M20 2 L36 8 L36 18 C36 28 28 36 20 38 C12 36 4 28 4 18 L4 8 Z"
        fill="#1E293B"
        stroke="#F59E0B"
        strokeWidth={2}
      />

      {/* Center circle with amber accent */}
      <Circle cx="20" cy="20" r="12" fill="#F59E0B" />

      {/* Inner dark circle for depth */}
      <Circle cx="20" cy="20" r="8" fill="#0F172A" />
    </Svg>
  );
}
