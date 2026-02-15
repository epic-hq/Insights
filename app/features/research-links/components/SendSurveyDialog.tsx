/**
 * Send Survey Dialog
 *
 * Modal flow for emailing survey invites: pick recipients → customize message → send.
 * Recipients can be selected from People CRM or entered as raw emails.
 */

import { Loader2, Mail, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Person {
  id: string;
  name: string | null;
  primary_email: string | null;
  person_type: string | null;
}

interface Recipient {
  email: string;
  name?: string;
  personId?: string;
}

interface SendSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  projectId: string;
  surveyId: string;
  surveySlug: string;
  surveyName: string;
  fromEmail: string;
  /** People from CRM with emails */
  people: Person[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendSurveyDialog({
  open,
  onOpenChange,
  accountId,
  projectId,
  surveyId,
  surveySlug,
  surveyName,
  fromEmail,
  people,
}: SendSurveyDialogProps) {
  const sendFetcher = useFetcher();
  const isSending = sendFetcher.state !== "idle";

  // State
  const [step, setStep] = useState<"recipients" | "preview">("recipients");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [subject, setSubject] = useState(
    `Quick feedback request: ${surveyName}`,
  );
  const [customMessage, setCustomMessage] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("recipients");
      setRecipients([]);
      setEmailInput("");
      setCustomMessage("");
      setPeopleSearch("");
    }
  }, [open]);

  // Handle send response
  useEffect(() => {
    if (sendFetcher.state === "idle" && sendFetcher.data) {
      const result = sendFetcher.data as {
        success?: boolean;
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (result.success) {
        const msg =
          result.failed && result.failed > 0
            ? `Sent ${result.sent} of ${(result.sent ?? 0) + result.failed} emails (${result.failed} failed)`
            : `${result.sent} survey invite${result.sent === 1 ? "" : "s"} sent`;
        toast.success(msg);
        onOpenChange(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    }
  }, [sendFetcher.state, sendFetcher.data, onOpenChange]);

  // Filtered people for picker (has email, not already added)
  const filteredPeople = useMemo(() => {
    const addedEmails = new Set(recipients.map((r) => r.email.toLowerCase()));
    return people
      .filter(
        (p) =>
          p.primary_email && !addedEmails.has(p.primary_email.toLowerCase()),
      )
      .filter(
        (p) =>
          !peopleSearch ||
          p.name?.toLowerCase().includes(peopleSearch.toLowerCase()) ||
          p.primary_email?.toLowerCase().includes(peopleSearch.toLowerCase()),
      )
      .slice(0, 20);
  }, [people, recipients, peopleSearch]);

  // Add person from CRM
  const addPerson = useCallback((person: Person) => {
    if (!person.primary_email) return;
    setRecipients((prev) => [
      ...prev,
      {
        email: person.primary_email!,
        name: person.name || undefined,
        personId: person.id,
      },
    ]);
    setPeopleSearch("");
  }, []);

  // Add raw email(s) from input
  const addEmailsFromInput = useCallback(() => {
    const raw = emailInput.trim();
    if (!raw) return;

    // Support comma/semicolon/newline separated emails
    const emails = raw
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const addedEmails = new Set(recipients.map((r) => r.email.toLowerCase()));
    const newRecipients: Recipient[] = [];
    const invalid: string[] = [];

    for (const email of emails) {
      if (!isValidEmail(email)) {
        invalid.push(email);
        continue;
      }
      if (addedEmails.has(email.toLowerCase())) continue;
      addedEmails.add(email.toLowerCase());

      // Try to match to a person
      const matched = people.find(
        (p) => p.primary_email?.toLowerCase() === email.toLowerCase(),
      );
      newRecipients.push({
        email,
        name: matched?.name || undefined,
        personId: matched?.id,
      });
    }

    if (newRecipients.length > 0) {
      setRecipients((prev) => [...prev, ...newRecipients]);
    }
    if (invalid.length > 0) {
      toast.error(
        `Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`,
      );
    }
    setEmailInput("");
  }, [emailInput, recipients, people]);

  const removeRecipient = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }, []);

  const handleSend = () => {
    if (recipients.length === 0) return;

    sendFetcher.submit(
      JSON.stringify({
        accountId,
        projectId,
        surveyId,
        surveySlug,
        surveyName,
        subject,
        customMessage: customMessage || undefined,
        recipients,
      }),
      {
        method: "POST",
        action: "/api/gmail/send-survey",
        encType: "application/json",
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {step === "recipients" ? "Select Recipients" : "Preview & Send"}
          </DialogTitle>
          <DialogDescription>
            {step === "recipients"
              ? "Choose people from your CRM or paste email addresses."
              : `Sending from ${fromEmail} to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "recipients" ? (
          <div className="space-y-4">
            {/* Manual email input */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Add emails
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com (comma-separated for bulk)"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmailsFromInput();
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmailsFromInput}
                  disabled={!emailInput.trim()}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* People picker */}
            {people.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  From your contacts
                </Label>
                <Input
                  placeholder="Search people..."
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                  className="h-9"
                />
                {(peopleSearch || filteredPeople.length <= 8) &&
                  filteredPeople.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border">
                      {filteredPeople.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => addPerson(person)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {person.name || "Unnamed"}
                          </span>
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {person.primary_email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Selected recipients */}
            {recipients.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Recipients ({recipients.length})
                </Label>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-2">
                  {recipients.map((r) => (
                    <Badge
                      key={r.email}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs"
                    >
                      {r.name ? `${r.name} (${r.email})` : r.email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(r.email)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Custom message */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Message (optional)
              </Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="I'd love to get your feedback. It only takes a few minutes."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Email preview */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="rounded-md border bg-white p-4 text-sm dark:bg-zinc-950">
                <p className="mb-1 text-xs text-muted-foreground">
                  From: {fromEmail}
                </p>
                <p className="mb-1 text-xs text-muted-foreground">
                  To: {recipients.length} recipient
                  {recipients.length === 1 ? "" : "s"}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Subject: {subject}
                </p>
                <div className="border-t pt-3">
                  <p className="mb-2 text-foreground">
                    Hi {recipients[0]?.name || "there"},
                  </p>
                  <p className="mb-3 text-foreground">
                    {customMessage ||
                      "I'd love to get your feedback. It only takes a few minutes."}
                  </p>
                  <div className="mb-3">
                    <span className="inline-block rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white">
                      Take the Survey
                    </span>
                  </div>
                  <p className="text-foreground">
                    Thanks,
                    <br />
                    {fromEmail}
                  </p>
                </div>
              </div>
            </div>

            {/* Recipient summary */}
            <div className="flex flex-wrap gap-1">
              {recipients.slice(0, 5).map((r) => (
                <Badge key={r.email} variant="outline" className="text-xs">
                  {r.name || r.email}
                </Badge>
              ))}
              {recipients.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{recipients.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "preview" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("recipients")}
              disabled={isSending}
            >
              Back
            </Button>
          )}
          {step === "recipients" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep("preview")}
              disabled={recipients.length === 0}
              className="gap-2"
            >
              Next: Preview
              <Mail className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={isSending || recipients.length === 0}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send {recipients.length} Email
                  {recipients.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
