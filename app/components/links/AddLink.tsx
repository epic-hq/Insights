import { Briefcase, Building2, Check, Loader2, Plus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";

export type Link_kind = "person" | "organization" | "opportunity";

export type Add_link_item = {
	id: string;
	label: string;
	link_id: string;
	href?: string;
	company?: string | null;
	segment?: string | null;
};

export type Add_link_option = {
	id: string;
	label: string;
};

export type Add_link_kind_config = {
	kind: Link_kind;
	label_singular: string;
	label_plural: string;
	linked_items: Add_link_item[];
	available_items: Add_link_option[];
	on_link: (id: string) => void;
	on_unlink: (link_id: string) => void;
	on_create_and_link?: (label: string) => void;
};

function get_kind_icon(kind: Link_kind) {
	switch (kind) {
		case "person":
			return Users;
		case "organization":
			return Building2;
		case "opportunity":
			return Briefcase;
	}
}

export function AddLink({
	kinds,
	default_kind = "person",
	disabled,
	is_loading,
	className,
}: {
	kinds: Add_link_kind_config[];
	default_kind?: Link_kind;
	disabled?: boolean;
	is_loading?: boolean;
	className?: string;
}) {
	const kind_map = useMemo(() => {
		const map = new Map<Link_kind, Add_link_kind_config>();
		for (const k of kinds) map.set(k.kind, k);
		return map;
	}, [kinds]);

	const [active_kind, set_active_kind] = useState<Link_kind>(default_kind);
	const [show_popover, set_show_popover] = useState(false);
	const [search_input, set_search_input] = useState("");

	const active = kind_map.get(active_kind);
	const linked_ids = useMemo(() => {
		const ids = new Set<string>();
		for (const item of active?.linked_items ?? []) ids.add(item.id);
		return ids;
	}, [active?.linked_items]);

	const unlinked_options = useMemo(() => {
		const options = (active?.available_items ?? []).filter((opt) => !linked_ids.has(opt.id));
		if (!search_input.trim()) return options;
		const needle = search_input.toLowerCase();
		return options.filter((opt) => opt.label.toLowerCase().includes(needle));
	}, [active?.available_items, linked_ids, search_input]);

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			{is_loading ? (
				<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
			) : (
				kinds.map((k) => {
					if (k.linked_items.length === 0) return null;
					const Icon = get_kind_icon(k.kind);
					return (
						<div
							key={k.kind}
							className={cn("flex flex-wrap items-center", k.kind === "person" ? "gap-3 text-sm" : "gap-2")}
						>
							{k.kind === "person" ? (
								<span className="text-muted-foreground">{k.label_plural}:</span>
							) : (
								<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
									<Icon className="h-4 w-4" />
									<span>{k.label_plural}:</span>
								</div>
							)}
							{k.kind === "person"
								? k.linked_items.map((item) => (
										<div key={item.link_id} className="flex items-center gap-1.5">
											{item.href ? (
												<Link
													to={item.href}
													className="font-medium text-foreground hover:underline"
													onClick={(e) => {
														e.stopPropagation();
													}}
												>
													{item.label}
												</Link>
											) : (
												<span className="font-medium text-foreground">{item.label}</span>
											)}
											{item.company && <span className="text-muted-foreground">({item.company})</span>}
											{item.segment && item.segment !== "Unknown" && (
												<Badge variant="outline" className="text-xs">
													{item.segment}
												</Badge>
											)}
											<button
												onClick={() => k.on_unlink(item.link_id)}
												className="ml-1 rounded-full p-0.5 opacity-60 hover:bg-destructive/20 hover:opacity-100"
												title="Remove link"
												type="button"
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									))
								: k.linked_items.map((item) => (
										<Badge key={item.link_id} variant="secondary" className="group flex items-center gap-1 pr-1">
											<span>{item.label}</span>
											<button
												onClick={() => k.on_unlink(item.link_id)}
												className="ml-1 rounded-full p-0.5 opacity-60 hover:bg-destructive/20 hover:opacity-100"
												title="Remove link"
												type="button"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
						</div>
					);
				})
			)}

			<Popover open={show_popover} onOpenChange={set_show_popover}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-6 gap-1 px-2 text-xs"
						disabled={disabled || is_loading}
						type="button"
					>
						<Plus className="h-3 w-3" />
						Add Link
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[320px] p-0" align="start">
					<div className="border-border border-b p-3">
						<Select
							value={active_kind}
							onValueChange={(value) => {
								set_active_kind(value as Link_kind);
								set_search_input("");
							}}
						>
							<SelectTrigger className="h-8">
								<SelectValue placeholder="Link type" />
							</SelectTrigger>
							<SelectContent>
								{kinds.map((k) => (
									<SelectItem key={k.kind} value={k.kind}>
										{k.label_singular}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<Command>
						<CommandInput
							placeholder={active ? `Search ${active.label_plural.toLowerCase()} or create...` : "Search or create..."}
							value={search_input}
							onValueChange={set_search_input}
						/>
						<CommandList>
							<CommandEmpty>
								<p className="py-2 text-center text-muted-foreground text-sm">
									{active ? `No ${active.label_plural.toLowerCase()} found` : "No items found"}
								</p>
							</CommandEmpty>
							<CommandGroup>
								{unlinked_options.map((opt) => (
									<CommandItem
										key={opt.id}
										value={opt.label}
										onSelect={() => {
											active?.on_link(opt.id);
											set_show_popover(false);
											set_search_input("");
										}}
									>
										<Check className={cn("mr-2 h-4 w-4 opacity-0")} />
										{opt.label}
									</CommandItem>
								))}
							</CommandGroup>
							{active?.on_create_and_link && (
								<>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											value={`create-new-${search_input}`}
											onSelect={() => {
												if (search_input.trim()) {
													active.on_create_and_link?.(search_input.trim());
													set_show_popover(false);
													set_search_input("");
												}
											}}
											className="text-primary"
										>
											<Plus className="mr-2 h-4 w-4" />
											{search_input.trim()
												? `Create "${search_input.trim()}"`
												: `Create new ${active.label_singular.toLowerCase()}...`}
										</CommandItem>
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
