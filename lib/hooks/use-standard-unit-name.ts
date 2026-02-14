"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to retrieve the configured standard unit name from system_config
 *
 * @returns Object with unitName (string) and isLoading (boolean)
 */
export function useStandardUnitName(): { unitName: string; isLoading: boolean } {
  const [unitName, setUnitName] = useState<string>("Standard Units");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUnitName = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "standard_unit_name")
        .single();

      if (!error && data) {
        setUnitName(data.value);
      } else {
        // Fallback to default if not found or error
        setUnitName("Standard Units");
      }
    } catch (err) {
      // On any error, use default
      setUnitName("Standard Units");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnitName();
  }, [fetchUnitName]);

  return { unitName, isLoading };
}
