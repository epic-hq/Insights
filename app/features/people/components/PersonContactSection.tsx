/**
 * PersonContactSection - Ultra-compact contact info display with edit toggle
 *
 * Default view shows a single inline row of contact methods as clickable links
 * separated by middot separators. Edit mode expands to show InlineEditableField
 * components for each primary field plus any JSONB contact_info entries.
 */

import type { LucideIcon } from "lucide-react";
import {
  ExternalLink,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Twitter,
} from "lucide-react";
import { useState } from "react";
import { InlineEditableField } from "~/components/InlineEditableField";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PersonContactSectionProps {
  /** Person data with contact fields */
  person: {
    id: string;
    primary_email: string | null;
    primary_phone: string | null;
    linkedin_url: string | null;
    contact_info: Record<string, string> | null;
  };
  /** When true, renders without the card wrapper (for embedding inside another card) */
  embedded?: boolean;
}

/** Parsed contact item for display */
interface ContactItem {
  type: string;
  value: string;
  displayValue: string;
  href?: string;
  icon: LucideIcon;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse all contact methods from a person record into a flat list
 * of display-ready items with icons, hrefs, and formatted display values.
 */
function parseContactItems(
  person: PersonContactSectionProps["person"],
): ContactItem[] {
  const items: ContactItem[] = [];

  if (person.primary_email) {
    items.push({
      type: "Email",
      value: person.primary_email,
      displayValue: person.primary_email,
      href: `mailto:${person.primary_email}`,
      icon: Mail,
    });
  }

  if (person.primary_phone) {
    items.push({
      type: "Phone",
      value: person.primary_phone,
      displayValue: person.primary_phone,
      href: `tel:${person.primary_phone.replace(/\s/g, "")}`,
      icon: Phone,
    });
  }

  if (person.linkedin_url) {
    const displayValue = person.linkedin_url
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
      .replace(/\/$/, "");
    const href = person.linkedin_url.startsWith("http")
      ? person.linkedin_url
      : `https://linkedin.com/in/${person.linkedin_url}`;
    items.push({
      type: "LinkedIn",
      value: person.linkedin_url,
      displayValue: `in/${displayValue}`,
      href,
      icon: Linkedin,
    });
  }

  // Additional JSONB contact_info fields
  const info = person.contact_info;
  if (info) {
    if (info.twitter) {
      const handle = info.twitter
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, "");
      items.push({
        type: "X / Twitter",
        value: info.twitter,
        displayValue: `@${handle}`,
        href: `https://x.com/${handle}`,
        icon: Twitter,
      });
    }
    if (info.instagram) {
      const handle = info.instagram
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
        .replace(/\/$/, "");
      items.push({
        type: "Instagram",
        value: info.instagram,
        displayValue: `@${handle}`,
        href: `https://instagram.com/${handle}`,
        icon: Instagram,
      });
    }
    if (info.website) {
      const displayValue = info.website
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
      items.push({
        type: "Website",
        value: info.website,
        displayValue,
        href: info.website.startsWith("http")
          ? info.website
          : `https://${info.website}`,
        icon: Globe,
      });
    }
    if (info.address) {
      items.push({
        type: "Address",
        value: info.address,
        displayValue: info.address,
        icon: MapPin,
      });
    }
  }

  return items;
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function PersonContactSection({
  person,
  embedded = false,
}: PersonContactSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  const contactItems = parseContactItems(person);
  const hasAnyContact = contactItems.length > 0;

  const content = (
    <>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Contact
        </p>
        {hasAnyContact && (
          <Button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
          >
            <Pencil className="mr-1 h-3 w-3" />
            {isEditing ? "Done" : "Edit"}
          </Button>
        )}
      </div>

      {/* ── Edit mode ──────────────────────────────────────────────── */}
      {isEditing && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Email
            </label>
            <InlineEditableField
              value={person.primary_email}
              entityId={person.id}
              entityIdKey="personId"
              field="primary_email"
              placeholder="Add email"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Phone
            </label>
            <InlineEditableField
              value={person.primary_phone}
              entityId={person.id}
              entityIdKey="personId"
              field="primary_phone"
              placeholder="Add phone"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">
              LinkedIn
            </label>
            <InlineEditableField
              value={person.linkedin_url}
              entityId={person.id}
              entityIdKey="personId"
              field="linkedin_url"
              placeholder="Add LinkedIn URL"
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* ── Compact display mode ───────────────────────────────────── */}
      {!isEditing && hasAnyContact && (
        <div className="flex flex-wrap items-center gap-y-1">
          {contactItems.map((item, index) => {
            const IconComponent = item.icon;
            const isExternal =
              item.href &&
              !item.href.startsWith("mailto:") &&
              !item.href.startsWith("tel:");

            return (
              <span
                key={`${item.type}-${item.value}`}
                className="flex items-center"
              >
                {index > 0 && (
                  <span className="mx-2 text-muted-foreground/50 text-xs">
                    &middot;
                  </span>
                )}
                {item.href ? (
                  <a
                    href={item.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1.5 text-foreground text-sm transition-colors hover:text-primary"
                  >
                    <IconComponent className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{item.displayValue}</span>
                    {isExternal && (
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    )}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-foreground text-sm">
                    <IconComponent className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{item.displayValue}</span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!isEditing && !hasAnyContact && (
        <div className="space-y-2">
          <p className="text-muted-foreground/60 text-sm italic">
            No contact information yet.
          </p>
          <Button
            type="button"
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Contact Info
          </Button>
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
      {content}
    </div>
  );
}
