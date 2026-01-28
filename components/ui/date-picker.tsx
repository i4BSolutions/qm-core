"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  className,
  disabled = false,
  minDate,
  maxDate,
}: DatePickerProps) {
  // Build disabled matcher for dates outside min/max range
  const disabledDays = React.useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) {
      matchers.push({ before: minDate });
    }
    if (maxDate) {
      matchers.push({ after: maxDate });
    }
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-amber-500/50",
            !date && "text-slate-400",
            date && "text-slate-200",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
          {date ? format(date, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          disabled={disabledDays}
          initialFocus
        />
        <div className="border-t border-slate-700 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-amber-400 hover:text-amber-300 hover:bg-slate-800"
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
