import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight text-foreground">
            Inventory Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Inventory overview with WAC valuation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/stock-in">
            <Button variant="outline">
              <ArrowDownToLine className="h-4 w-4" />
              Stock In
            </Button>
          </Link>
          <Link href="/inventory/stock-out">
            <Button variant="outline">
              <ArrowUpFromLine className="h-4 w-4" />
              Stock Out
            </Button>
          </Link>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="card-elevated flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Inventory Dashboard will be implemented in Iteration 9
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock In/Out, WAC calculation, warehouse views
          </p>
        </div>
      </div>
    </div>
  );
}
