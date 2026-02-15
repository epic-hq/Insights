/**
 * Enhanced data table for Ask link responses
 * Features: search, sort, column fitting, text wrap, person links, video playback, delete, multi-select
 */
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpDown,
  ExternalLink,
  Loader2,
  Play,
  Search,
  Trash2,
  User,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ResponseWithPerson } from "../db";
import type { ResearchLinkQuestion } from "../schemas";
import { extractAnswer } from "../utils";

type ResponseWithSignedVideo = ResponseWithPerson & {
  signed_video_url?: string | null;
};

interface ResearchLinkResponsesDataTableProps {
  questions: ResearchLinkQuestion[];
  responses: ResponseWithSignedVideo[];
  basePath: string; // e.g., /a/:accountId/:projectId
  listId: string;
}

export function ResearchLinkResponsesDataTable({
  questions,
  responses,
  basePath,
  listId,
}: ResearchLinkResponsesDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    url: string | null;
    email: string;
  }>({ open: false, url: null, email: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    mode: "single" | "bulk";
    responseId: string | null;
    responseIds: string[];
    email: string;
  }>({
    open: false,
    mode: "single",
    responseId: null,
    responseIds: [],
    email: "",
  });

  const deleteFetcher = useFetcher();
  const revalidator = useRevalidator();
  const isDeleting = deleteFetcher.state !== "idle";

  const handleDeleteSingle = (responseId: string) => {
    deleteFetcher.submit(null, {
      method: "DELETE",
      action: `/api/research-links/${listId}/responses/${responseId}/delete`,
    });
    setDeleteConfirm({
      open: false,
      mode: "single",
      responseId: null,
      responseIds: [],
      email: "",
    });
    setTimeout(() => revalidator.revalidate(), 100);
  };

  const handleDeleteBulk = (responseIds: string[]) => {
    deleteFetcher.submit(
      { responseIds },
      {
        method: "POST",
        action: `/api/research-links/${listId}/responses/delete`,
        encType: "application/json",
      },
    );
    setDeleteConfirm({
      open: false,
      mode: "single",
      responseId: null,
      responseIds: [],
      email: "",
    });
    setRowSelection({});
    setTimeout(() => revalidator.revalidate(), 100);
  };

  const selectedRows = Object.keys(rowSelection).filter(
    (key) => rowSelection[key],
  );
  const selectedCount = selectedRows.length;

  const columns = useMemo<ColumnDef<ResponseWithSignedVideo>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const email = row.original.email;
          const person = row.original.person;
          return (
            <div className="flex items-center gap-2">
              <a
                href={`mailto:${email}`}
                className="truncate text-primary hover:underline"
              >
                {email}
              </a>
              {person && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`${basePath}/people/${person.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <User className="h-3.5 w-3.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    View person: {person.name || email}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        size: 220,
      },
      ...questions.map((question) => ({
        id: question.id,
        accessorFn: (row: ResponseWithSignedVideo) =>
          extractAnswer(row, question),
        header: ({ column }: { column: any }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 max-w-[180px] truncate"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
              >
                <span className="truncate">{question.prompt}</span>
                <ArrowUpDown className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {question.prompt}
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const answer = getValue() as string | null;
          if (!answer) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const isLong = answer.length > 100;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`text-foreground text-sm ${isLong ? "line-clamp-2" : ""}`}
                >
                  {answer}
                </span>
              </TooltipTrigger>
              {isLong && (
                <TooltipContent className="max-w-md whitespace-pre-wrap">
                  {answer}
                </TooltipContent>
              )}
            </Tooltip>
          );
        },
        size: 200,
      })),
      {
        id: "video",
        accessorKey: "signed_video_url",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">
                <Video className="h-4 w-4 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Video Response</TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const signedUrl = row.original.signed_video_url;
          const email = row.original.email;
          if (!signedUrl) {
            return <span className="text-muted-foreground/40">—</span>;
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setVideoModal({ open: true, url: signedUrl, email })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                >
                  <Play className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Play video response</TooltipContent>
            </Tooltip>
          );
        },
        size: 50,
      },
      {
        id: "completed",
        accessorKey: "completed",
        header: "Status",
        cell: ({ getValue }) => {
          const completed = getValue() as boolean;
          return (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                completed
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {completed ? "Responded" : "In progress"}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "createdAt",
        accessorKey: "created_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Submitted
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const createdAt = getValue() as string | null;
          if (!createdAt) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(createdAt).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          );
        },
        sortingFn: (a, b) => {
          const aTime = a.original.created_at
            ? new Date(a.original.created_at).getTime()
            : 0;
          const bTime = b.original.created_at
            ? new Date(b.original.created_at).getTime()
            : 0;
          return aTime - bTime;
        },
        size: 120,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={`${basePath}/ask/${listId}/responses/${row.original.id}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>View response</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      open: true,
                      mode: "single",
                      responseId: row.original.id,
                      responseIds: [],
                      email: row.original.email,
                    })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete response</TooltipContent>
            </Tooltip>
          </div>
        ),
        size: 80,
      },
    ],
    [questions, basePath, listId],
  );

  const table = useReactTable({
    data: responses,
    columns,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
  });

  const handleBulkDeleteClick = () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);
    setDeleteConfirm({
      open: true,
      mode: "bulk",
      responseId: null,
      responseIds: selectedIds,
      email: "",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search responses..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteClick}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete {selectedCount} selected
            </Button>
          )}
          <p className="text-muted-foreground text-sm">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : `${table.getFilteredRowModel().rows.length} of ${responses.length} responses`}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {globalFilter
                      ? "No matching responses found"
                      : "No responses yet"}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/50"
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          maxWidth: cell.column.getSize(),
                        }}
                        className="overflow-hidden"
                      >
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

      {/* Video Player Modal */}
      <Dialog
        open={videoModal.open}
        onOpenChange={(open) => setVideoModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Video Response from {videoModal.email}</DialogTitle>
          </DialogHeader>
          {videoModal.url && (
            <div className="overflow-hidden rounded-lg">
              <video
                src={videoModal.url}
                className="aspect-video w-full bg-black"
                controls
                autoPlay
                playsInline
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm.mode === "bulk"
                ? `Delete ${deleteConfirm.responseIds.length} responses?`
                : "Delete response?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.mode === "bulk" ? (
                <>
                  This will permanently delete{" "}
                  <span className="font-medium">
                    {deleteConfirm.responseIds.length} responses
                  </span>
                  . This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete the response from{" "}
                  <span className="font-medium">{deleteConfirm.email}</span>.
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm.mode === "bulk") {
                  handleDeleteBulk(deleteConfirm.responseIds);
                } else if (deleteConfirm.responseId) {
                  handleDeleteSingle(deleteConfirm.responseId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
