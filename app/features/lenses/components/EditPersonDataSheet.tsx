/**
 * EditPersonDataSheet - Side drawer for editing ICP-relevant person fields
 *
 * Full field set: Job Title, Job Function, Seniority, Organization (autocomplete),
 * Industry, and Company Size. All fields the ICP scoring algorithm uses.
 * Shows toast on save and advances to the next person for a to-do list feel.
 */

import { Check, ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  COMPANY_SIZE_RANGES,
  INDUSTRIES,
  JOB_FUNCTIONS,
  SENIORITY_LEVELS,
} from "~/lib/constants/options";
import { cn } from "~/lib/utils";
import type { ICPScoredPerson } from "./AnalysisByPersonTab";
import { BandBadge } from "./ICPMatchSection";

type EditPersonDataSheetProps = {
  person: ICPScoredPerson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  organizations: { id: string; name: string }[];
  onSaved?: (personId: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export function EditPersonDataSheet({
  person,
  open,
  onOpenChange,
  projectPath,
  organizations,
  onSaved,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: EditPersonDataSheetProps) {
  const revalidator = useRevalidator();
  const [isSaving, setIsSaving] = useState(false);

  // Person fields
  const [title, setTitle] = useState("");
  const [jobFunction, setJobFunction] = useState("");
  const [seniority, setSeniority] = useState("");

  // Org fields
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState<string | null>(null);
  const [industry, setIndustry] = useState("");
  const [sizeRange, setSizeRange] = useState("");

  // Reset form when person changes
  useEffect(() => {
    if (person) {
      setTitle(person.title || "");
      setJobFunction(person.job_function || "");
      setSeniority(person.seniority_level || "");
      setSelectedOrgId(person.default_organization_id);
      setIndustry(person.org_industry || "");
      setSizeRange(person.org_size_range || "");
      setOrgSearch("");
      setNewOrgName(null);
    }
  }, [person]);

  // All hooks must be called before any early return (React rules of hooks)
  const selectedOrgName = useMemo(() => {
    if (!person) return null;
    if (newOrgName) return newOrgName;
    if (!selectedOrgId) return person.org_name || null;
    const org = organizations.find((o) => o.id === selectedOrgId);
    return org?.name || person.org_name || null;
  }, [selectedOrgId, organizations, person, newOrgName]);

  const filteredOrgs = useMemo(() => {
    if (!orgSearch) return organizations;
    const lower = orgSearch.toLowerCase();
    return organizations.filter((org) =>
      org.name?.toLowerCase().includes(lower),
    );
  }, [organizations, orgSearch]);

  if (!person) return null;

  const updateEndpoint = `${projectPath}/people/api/update-inline`;

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setNewOrgName(null);
    setOrgPopoverOpen(false);
    setOrgSearch("");
  };

  const handleCreateOrg = () => {
    if (!orgSearch.trim()) return;
    setNewOrgName(orgSearch.trim());
    setSelectedOrgId(null);
    setOrgPopoverOpen(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Person field updates
      const personUpdates: { field: string; value: string | null }[] = [];

      if ((title || "") !== (person.title || "")) {
        personUpdates.push({ field: "title", value: title || null });
      }
      if ((jobFunction || "") !== (person.job_function || "")) {
        personUpdates.push({
          field: "job_function",
          value: jobFunction || null,
        });
      }
      if ((seniority || "") !== (person.seniority_level || "")) {
        personUpdates.push({
          field: "seniority_level",
          value: seniority || null,
        });
      }

      for (const { field, value } of personUpdates) {
        const res = await fetch(updateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: person.person_id,
            field,
            value,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to update ${field}`);
        }
      }

      // 2. Organization link change
      const orgChanged = selectedOrgId !== person.default_organization_id;
      const isNewOrg = !!newOrgName;
      let createdOrgId: string | undefined;

      if (orgChanged && selectedOrgId) {
        const res = await fetch(updateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: person.person_id,
            field: "organization",
            organizationId: selectedOrgId,
            value: "",
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to link organization");
        }
      } else if (isNewOrg) {
        const res = await fetch(updateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: person.person_id,
            field: "organization",
            newOrganizationName: newOrgName,
            value: "",
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create organization");
        }
        const result = await res.json();
        createdOrgId = result.organizationId;
      }

      // 3. Org field updates (industry, size_range) — only if we have an org linked
      const targetOrgId =
        createdOrgId || selectedOrgId || person.default_organization_id;
      if (targetOrgId) {
        if ((industry || "") !== (person.org_industry || "")) {
          const res = await fetch(updateEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: person.person_id,
              organizationId: targetOrgId,
              orgField: "industry",
              field: "orgIndustry",
              value: industry || null,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to update industry");
          }
        }
        if ((sizeRange || "") !== (person.org_size_range || "")) {
          const res = await fetch(updateEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: person.person_id,
              organizationId: targetOrgId,
              orgField: "size_range",
              field: "orgSizeRange",
              value: sizeRange || null,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to update company size");
          }
        }
      }

      const totalChanges =
        personUpdates.length +
        (orgChanged || isNewOrg ? 1 : 0) +
        ((industry || "") !== (person.org_industry || "") ? 1 : 0) +
        ((sizeRange || "") !== (person.org_size_range || "") ? 1 : 0);

      if (totalChanges === 0) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      toast.success(`Updated ${person.name}`, {
        description: "Click 'Score All' to refresh ICP scores.",
      });
      revalidator.revalidate();
      onOpenChange(false);
      onSaved?.(person.person_id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {onNavigate && (
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={!hasPrev || isSaving}
                  onClick={() => onNavigate("prev")}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={!hasNext || isSaving}
                  onClick={() => onNavigate("next")}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div>
              <SheetTitle>{person.name}</SheetTitle>
              <BandBadge band={person.band} confidence={person.confidence} />
            </div>
          </div>
          <SheetDescription>
            Edit ICP-relevant fields for better scoring accuracy
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          <div className="space-y-5 px-1">
            {/* Person Fields */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">Job Title</Label>
              <Input
                id="edit-title"
                placeholder="e.g., Product Manager"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Used for ICP role matching (weight: 40%)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Job Function</Label>
              <Select
                value={jobFunction}
                onValueChange={(v) =>
                  setJobFunction(v === "__clear__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select function..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground">Clear</span>
                  </SelectItem>
                  {JOB_FUNCTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Seniority Level</Label>
              <Select
                value={seniority}
                onValueChange={(v) => setSeniority(v === "__clear__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground">Clear</span>
                  </SelectItem>
                  {SENIORITY_LEVELS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Organization Fields */}
            <div className="space-y-2">
              <Label>Organization</Label>
              <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start font-normal",
                      !selectedOrgName && "text-muted-foreground",
                    )}
                  >
                    {selectedOrgName || "Search or create..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search organizations..."
                      value={orgSearch}
                      onValueChange={setOrgSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {orgSearch ? (
                          <button
                            type="button"
                            onClick={handleCreateOrg}
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <Plus className="h-4 w-4" />
                            Create "{orgSearch}"
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
                            onSelect={() => handleSelectOrg(org.id)}
                            className="flex items-center gap-2"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedOrgId === org.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {org.name || "Unnamed"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {orgSearch &&
                        !filteredOrgs.some(
                          (o) =>
                            o.name?.toLowerCase() === orgSearch.toLowerCase(),
                        ) && (
                          <CommandGroup>
                            <CommandItem
                              onSelect={handleCreateOrg}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Create "{orgSearch}"
                            </CommandItem>
                          </CommandGroup>
                        )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-muted-foreground text-xs">
                Used for ICP organization matching (weight: 30%)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={industry}
                onValueChange={(v) => setIndustry(v === "__clear__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground">Clear</span>
                  </SelectItem>
                  {INDUSTRIES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Organization industry for ICP org matching
              </p>
            </div>

            <div className="space-y-2">
              <Label>Company Size</Label>
              <Select
                value={sizeRange}
                onValueChange={(v) => setSizeRange(v === "__clear__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">
                    <span className="text-muted-foreground">Clear</span>
                  </SelectItem>
                  {COMPANY_SIZE_RANGES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Used for ICP size matching (weight: 30%)
              </p>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
