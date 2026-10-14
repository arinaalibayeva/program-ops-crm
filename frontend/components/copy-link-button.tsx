"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({
  path,
  label = "Copy check-in link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the link is still visible on the event page.
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <Check /> : <Link2 />}
      {copied ? "Copied" : label}
    </Button>
  );
}
