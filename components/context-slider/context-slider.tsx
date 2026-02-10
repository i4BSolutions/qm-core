'use client';

/**
 * Context Slider Component
 *
 * Reusable slider shell for displaying contextual information alongside forms.
 * Used by QMHQ create page and stock-out request page.
 *
 * Desktop: Always visible on right side, push-content layout via parent grid
 * Mobile: Slide-in drawer from right with toggle button
 */

import { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextSliderProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string; // e.g. "QMRL Context" or "Request Context"
  children: React.ReactNode;
}

/**
 * Context Slider Shell
 *
 * Provides structural wrapper for context panels:
 * - Desktop: Visible in grid column, sticky position
 * - Mobile: Fixed slide-in drawer with backdrop
 * - Toggle: Close button (mobile only), floating button (mobile when closed)
 * - Body scroll lock on mobile when open
 */
export function ContextSlider({ isOpen, onToggle, title, children }: ContextSliderProps) {
  /**
   * Handle body scroll lock on mobile when drawer is open
   */
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Toggle Button - shown when panel is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={cn(
            'md:hidden fixed bottom-4 right-4 z-40',
            'flex items-center gap-2 rounded-full',
            'bg-gradient-to-r from-amber-600 to-amber-500',
            'px-4 py-3 shadow-lg',
            'hover:from-amber-500 hover:to-amber-400',
            'transition-all duration-200',
            'animate-fade-in'
          )}
          aria-label="Show context panel"
        >
          <FileText className="h-5 w-5 text-white" />
          <span className="text-sm font-medium text-white">Context</span>
        </button>
      )}

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Panel Container */}
      <div
        className={cn(
          // Desktop: visible in grid when open, hidden when closed
          'md:block md:relative',
          // Mobile: fixed slide-in drawer
          'fixed inset-y-0 right-0 z-50',
          'w-80 md:w-80 lg:w-96',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          // Styling
          'border-l border-slate-700 bg-slate-900',
          'overflow-hidden flex flex-col'
        )}
      >
        {/* Panel Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold uppercase tracking-wider text-amber-500">
              {title}
            </span>
          </div>
          {/* Close button - only visible on mobile */}
          <button
            onClick={onToggle}
            className="md:hidden text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>
      </div>
    </>
  );
}
