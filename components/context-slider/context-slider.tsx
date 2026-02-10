'use client';

/**
 * Context Slider Component
 *
 * Sticky side panel for displaying contextual information alongside forms.
 * Used by QMHQ create page and stock-out request page.
 *
 * Desktop: Always visible sticky panel in right grid column
 * Mobile: Stacked below main content
 */

import { FileText } from 'lucide-react';

interface ContextSliderProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Context Slider Shell
 *
 * Always-visible sticky side panel (like a sidebar tab):
 * - Desktop: Sticky in grid column, scrolls independently
 * - Mobile: Stacked below main content, full width
 */
export function ContextSlider({ title, children }: ContextSliderProps) {
  return (
    <div className="md:sticky md:top-4 md:self-start border border-slate-700 bg-slate-900 rounded-lg overflow-hidden flex flex-col md:max-h-[calc(100vh-2rem)]">
      {/* Panel Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 p-4 border-b border-slate-700 bg-slate-900">
        <FileText className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold uppercase tracking-wider text-amber-500">
          {title}
        </span>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}
