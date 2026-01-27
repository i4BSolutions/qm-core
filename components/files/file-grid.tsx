'use client';

/**
 * File Grid Component
 *
 * Grid layout container for file cards.
 * Displays files in a 4-column responsive grid with overflow scrolling.
 */

import { cn } from '@/lib/utils';

interface FileGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * File grid component for laying out file cards.
 *
 * Features:
 * - 4-column grid layout
 * - Responsive gap spacing
 * - Scrollable when content exceeds max height
 * - Smooth scrolling behavior
 *
 * @param children - FileCard components to display
 * @param className - Additional CSS classes
 *
 * @example
 * <FileGrid>
 *   {files.map(file => (
 *     <FileCard key={file.id} file={file} />
 *   ))}
 * </FileGrid>
 */
export function FileGrid({ children, className }: FileGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-4',
        'max-h-[500px] overflow-y-auto',
        'scroll-smooth',
        className
      )}
    >
      {children}
    </div>
  );
}
