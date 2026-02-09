/**
 * PeopleDataTable - Inline editable table for people/contacts
 *
 * Features:
 * - Click-to-edit cells for name, title, job function, seniority
 * - Organization autocomplete with create-new option
 * - Optimistic updates with error handling
 * - Column visibility selector with localStorage persistence
 */

import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  Check,
  Columns3,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { COMPANY_SIZE_RANGES } from "~/lib/constants/options";
import { cn } from "~/lib/utils";
import { BandBadge } from "~/features/lenses/components/ICPMatchSection";
import { EditableNameField } from "./EditableNameField";

export interface PersonTableRow {
  id: string;
  name: string;
  firstname?: string | null;
  lastname?: string | null;
  title?: string | null;
  organization?: {
    id: string;
    name?: string | null;
    job_title?: string | null;
  } | null;
  conversationCount: number;
  evidenceCount: number;
  stakeholderStatus?: string | null;
  updatedAt?: string | null;
  // Segment data
  jobFunction?: string | null;
  seniority?: string | null;
  segment?: string | null;
  companySize?: string | null;
  // ICP score data
  icpBand?: string | null;
  icpScore?: number | null;
  icpConfidence?: number | null;
}

interface Organization {
  id: string;
  name: string | null;
}

interface PeopleDataTableProps {
  rows: PersonTableRow[];
  organizations?: Organization[];
}

// Job function options
const JOB_FUNCTIONS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Operations",
  "Finance",
  "HR",
  "Legal",
  "Executive",
  "Data",
  "IT",
  "Research",
  "Other",
];

// Seniority options
const SENIORITY_LEVELS = [
  "C-Level",
  "VP",
  "Director",
  "Manager",
  "Senior",
  "IC",
  "Intern",
];

// Editable text cell component with optimistic updates
function EditableTextCell({
  value,
  personId,
  field,
  placeholder,
  endpoint,
}: {
  value: string | null | undefined;
  personId: string;
  field: string;
  placeholder?: string;
  endpoint: string;
}) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive optimistic value from pending submission
  const isPending = fetcher.state !== "idle";
  const pendingValue =
    isPending && fetcher.formData?.get("personId") === personId
      ? (fetcher.formData?.get("value") as string)
      : undefined;
  const displayValue = pendingValue ?? value;

  // Reset edit value when server value changes
  useEffect(() => {
    if (!isEditing && !isPending) {
      setEditValue(value ?? "");
    }
  }, [value, isEditing, isPending]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue === (value ?? "")) {
      setIsEditing(false);
      return;
    }

    // Submit via fetcher for optimistic update
    fetcher.submit(
      { personId, field, value: editValue || "" },
      { method: "POST", action: endpoint },
    );
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value ?? "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 text-sm"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted",
        !displayValue && "text-muted-foreground",
        isPending && "opacity-70",
      )}
    >
      <span className="flex-1 truncate">
        {displayValue || placeholder || "—"}
      </span>
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </button>
  );
}

// Editable select cell component with optimistic updates
function EditableSelectCell({
  value,
  personId,
  field,
  options,
  placeholder,
  endpoint,
}: {
  value: string | null | undefined;
  personId: string;
  field: string;
  options: string[];
  placeholder?: string;
  endpoint: string;
}) {
  const fetcher = useFetcher();

  // Derive optimistic value from pending submission
  const isPending = fetcher.state !== "idle";
  const pendingValue =
    isPending && fetcher.formData?.get("personId") === personId
      ? (fetcher.formData?.get("value") as string)
      : undefined;
  const displayValue = pendingValue ?? value;

  const handleChange = (newValue: string) => {
    if (newValue === value) return;

    // Submit via fetcher for optimistic update
    fetcher.submit(
      { personId, field, value: newValue === "__clear__" ? "" : newValue },
      { method: "POST", action: endpoint },
    );
  };

  return (
    <Select
      value={displayValue ?? ""}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn("h-7 w-[130px] text-xs", isPending && "opacity-70")}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue placeholder={placeholder || "—"} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__">
          <span className="text-muted-foreground">Clear</span>
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Organization picker with autocomplete and create-new
function OrganizationCell({
  value,
  personId,
  organizations,
  endpoint,
  orgDetailUrl,
}: {
  value: { id: string; name?: string | null } | null | undefined;
  personId: string;
  organizations: Organization[];
  endpoint: string;
  orgDetailUrl?: string;
}) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingOrgName, setPendingOrgName] = useState<string | null>(null);

  // Track pending state
  const isPending = fetcher.state !== "idle";

  // Show pending org name while saving
  const displayName = pendingOrgName ?? value?.name;

  // Trigger revalidation when fetcher completes (don't clear pending name yet)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  // Clear pending name once revalidated data catches up
  useEffect(() => {
    if (pendingOrgName && value?.name) {
      setPendingOrgName(null);
    }
  }, [value?.name, pendingOrgName]);

  const filteredOrgs = useMemo(() => {
    if (!search) return organizations;
    const lower = search.toLowerCase();
    return organizations.filter((org) =>
      org.name?.toLowerCase().includes(lower),
    );
  }, [organizations, search]);

  const handleSelect = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setPendingOrgName(org.name);
    }
    fetcher.submit(
      { personId, field: "organization", organizationId: orgId, value: "" },
      { method: "POST", action: endpoint },
    );
    setOpen(false);
    setSearch("");
  };

  const handleCreateNew = () => {
    if (!search.trim()) return;
    setPendingOrgName(search.trim());
    fetcher.submit(
      {
        personId,
        field: "organization",
        newOrganizationName: search.trim(),
        value: "",
      },
      { method: "POST", action: endpoint },
    );
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="flex items-center gap-1">
      {/* Link to org detail page */}
      {orgDetailUrl && value?.id && (
        <Link
          to={orgDetailUrl}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          title="View organization"
          onClick={(e) => e.stopPropagation()}
        >
          <Building2 className="h-3 w-3" />
        </Link>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted",
              !displayName && "text-muted-foreground",
              isPending && "opacity-70",
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="flex-1 truncate">{displayName}</span>
              </>
            ) : displayName ? (
              <>
                <span className="flex-1 truncate">{displayName}</span>
                <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search ? (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted"
                    disabled={isPending}
                  >
                    <Plus className="h-4 w-4" />
                    Create "{search}"
                  </button>
                ) : (
                  <span className="px-2 py-1.5 text-muted-foreground text-sm">
                    No organizations found
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredOrgs.map((org) => (
                  <CommandItem
                    key={org.id}
                    value={org.name ?? org.id}
                    onSelect={() => handleSelect(org.id)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value?.id === org.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {org.name || "Unnamed"}
                  </CommandItem>
                ))}
              </CommandGroup>
              {search &&
                !filteredOrgs.some(
                  (o) => o.name?.toLowerCase() === search.toLowerCase(),
                ) && (
                  <CommandGroup>
                    <CommandItem
                      onSelect={handleCreateNew}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create "{search}"
                    </CommandItem>
                  </CommandGroup>
                )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Org role editable cell component with optimistic updates
function OrgRoleCell({
  value,
  personId,
  organizationId,
  endpoint,
}: {
  value: string | null | undefined;
  personId: string;
  organizationId: string | undefined;
  endpoint: string;
}) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive optimistic value from pending submission
  const isPending = fetcher.state !== "idle";
  const pendingValue =
    isPending && fetcher.formData?.get("personId") === personId
      ? (fetcher.formData?.get("value") as string)
      : undefined;
  const displayValue = pendingValue ?? value;

  // Reset edit value when server value changes
  useEffect(() => {
    if (!isEditing && !isPending) {
      setEditValue(value ?? "");
    }
  }, [value, isEditing, isPending]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Can't edit if no organization linked
  if (!organizationId) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const handleSave = () => {
    if (editValue === (value ?? "")) {
      setIsEditing(false);
      return;
    }

    fetcher.submit(
      {
        personId,
        organizationId,
        orgField: "job_title",
        field: "orgRole",
        value: editValue || "",
      },
      { method: "POST", action: endpoint },
    );
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value ?? "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 text-sm"
          placeholder="Role at org"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted",
        !displayValue && "text-muted-foreground",
        isPending && "opacity-70",
      )}
    >
      <span className="flex-1 truncate">{displayValue || "—"}</span>
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </button>
  );
}

// Company size editable cell component with optimistic updates
function CompanySizeCell({
  value,
  personId,
  organizationId,
  endpoint,
}: {
  value: string | null | undefined;
  personId: string;
  organizationId: string | undefined;
  endpoint: string;
}) {
  const fetcher = useFetcher();

  // Derive optimistic value from pending submission
  const isPending = fetcher.state !== "idle";
  const pendingValue =
    isPending && fetcher.formData?.get("personId") === personId
      ? (fetcher.formData?.get("value") as string)
      : undefined;
  const displayValue = pendingValue ?? value;

  // Can't edit if no organization linked
  if (!organizationId) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const handleChange = (newValue: string) => {
    if (newValue === value) return;

    fetcher.submit(
      {
        personId,
        organizationId,
        orgField: "size_range",
        field: "companySize",
        value: newValue === "__clear__" ? "" : newValue,
      },
      { method: "POST", action: endpoint },
    );
  };

  return (
    <Select
      value={displayValue ?? ""}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn("h-7 w-[110px] text-xs", isPending && "opacity-70")}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue placeholder="—" />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__">
          <span className="text-muted-foreground">Clear</span>
        </SelectItem>
        {COMPANY_SIZE_RANGES.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PeopleDataTable({
  rows,
  organizations = [],
}: PeopleDataTableProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const storageKey = "people_table_columns_v2";

  // Endpoint for inline updates - used by all editable cells
  const updateEndpoint = `${routes.people.index()}/api/update-inline`;

  const defaultColumnVisibility = useMemo<VisibilityState>(
    () => ({
      organization: true,
      orgRole: true,
      title: true,
      conversationCount: true,
      evidenceCount: true,
      stakeholderStatus: false,
      updatedAt: false,
      jobFunction: true,
      seniority: true,
      segment: false,
      companySize: true,
      icpBand: true,
    }),
    [],
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      if (typeof window === "undefined") return defaultColumnVisibility;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return defaultColumnVisibility;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object")
          return defaultColumnVisibility;
        return { ...defaultColumnVisibility, ...(parsed as VisibilityState) };
      } catch {
        return defaultColumnVisibility;
      }
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const columnLabels = useMemo<Record<string, string>>(
    () => ({
      organization: "Organization",
      orgRole: "Job Title at Org",
      title: "Title",
      conversationCount: "Conversations",
      evidenceCount: "Evidence",
      stakeholderStatus: "Status",
      updatedAt: "Last updated",
      jobFunction: "Job Function",
      seniority: "Seniority",
      segment: "Segment",
      companySize: "Company Size",
      icpBand: "ICP Match",
    }),
    [],
  );

  const columns = useMemo<ColumnDef<PersonTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const person = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                to={routes.people.detail(person.id)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                title="View details"
              >
                <span className="sr-only">View</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <EditableNameField
                firstname={person.firstname}
                lastname={person.lastname}
                personId={person.id}
                placeholder="—"
              />
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.title}
            personId={row.original.id}
            field="title"
            placeholder="—"
            endpoint={updateEndpoint}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "organization",
        header: "Organization",
        cell: ({ row }) => (
          <OrganizationCell
            value={row.original.organization}
            personId={row.original.id}
            organizations={organizations}
            endpoint={updateEndpoint}
            orgDetailUrl={
              row.original.organization?.id
                ? routes.organizations.detail(row.original.organization.id)
                : undefined
            }
          />
        ),
        enableSorting: false,
      },
      {
        id: "orgRole",
        accessorFn: (row) => row.organization?.job_title,
        header: "Job Title at Org",
        cell: ({ row }) => (
          <OrgRoleCell
            value={row.original.organization?.job_title}
            personId={row.original.id}
            organizationId={row.original.organization?.id}
            endpoint={updateEndpoint}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "jobFunction",
        header: "Job Function",
        cell: ({ row }) => (
          <EditableSelectCell
            value={row.original.jobFunction}
            personId={row.original.id}
            field="job_function"
            options={JOB_FUNCTIONS}
            placeholder="—"
            endpoint={updateEndpoint}
          />
        ),
        enableSorting: true,
      },
      {
        accessorKey: "seniority",
        header: "Seniority",
        cell: ({ row }) => (
          <EditableSelectCell
            value={row.original.seniority}
            personId={row.original.id}
            field="seniority_level"
            options={SENIORITY_LEVELS}
            placeholder="—"
            endpoint={updateEndpoint}
          />
        ),
        enableSorting: true,
      },
      {
        accessorKey: "conversationCount",
        header: "Conversations",
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">{getValue<number>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "evidenceCount",
        header: "Evidence",
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">{getValue<number>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "stakeholderStatus",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<string | null | undefined>();
          if (!status)
            return <span className="text-muted-foreground text-xs">—</span>;
          return <Badge variant="secondary">{status}</Badge>;
        },
        enableSorting: false,
      },
      {
        accessorKey: "companySize",
        header: "Company Size",
        cell: ({ row }) => (
          <CompanySizeCell
            value={row.original.companySize}
            personId={row.original.id}
            organizationId={row.original.organization?.id}
            endpoint={updateEndpoint}
          />
        ),
        enableSorting: true,
      },
      {
        accessorKey: "updatedAt",
        header: "Last Updated",
        cell: ({ getValue }) => {
          const updatedAt = getValue<string | null | undefined>();
          if (!updatedAt)
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          );
        },
        enableSorting: true,
        sortDescFirst: true,
        sortingFn: (a, b) => {
          const aValue = a.original.updatedAt
            ? new Date(a.original.updatedAt).getTime()
            : 0;
          const bValue = b.original.updatedAt
            ? new Date(b.original.updatedAt).getTime()
            : 0;
          return aValue - bValue;
        },
      },
      {
        accessorKey: "segment",
        header: "Segment",
        cell: ({ getValue }) => {
          const value = getValue<string | null | undefined>();
          if (!value)
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <Badge variant="secondary" className="text-xs">
              {value}
            </Badge>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "icpBand",
        header: "ICP Match",
        cell: ({ row }) => (
          <BandBadge
            band={row.original.icpBand ?? null}
            confidence={row.original.icpConfidence}
          />
        ),
        enableSorting: true,
        sortingFn: (a, b) => {
          const order: Record<string, number> = {
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
          };
          const aVal = order[a.original.icpBand ?? ""] ?? 0;
          const bVal = order[b.original.icpBand ?? ""] ?? 0;
          return aVal - bVal;
        },
      },
    ],
    [routes.people, routes.organizations.detail, organizations, updateEndpoint],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.keys(columnLabels).map((columnId) => {
              const column = table.getColumn(columnId);
              if (!column) return null;
              return (
                <DropdownMenuCheckboxItem
                  key={columnId}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(Boolean(value))
                  }
                >
                  {columnLabels[columnId]}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc"
                      ? " ↑"
                      : header.column.getIsSorted() === "desc"
                        ? " ↓"
                        : ""}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No people found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
