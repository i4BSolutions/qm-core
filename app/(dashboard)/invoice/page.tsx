import { Plus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui";

export default function InvoicePage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage invoices with partial invoicing support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-background p-1">
            <button className="rounded-md bg-accent px-3 py-1.5">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="card-elevated flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Invoices will be implemented in Iteration 8
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            4-step creation, quantity validation, void support
          </p>
        </div>
      </div>
    </div>
  );
}
