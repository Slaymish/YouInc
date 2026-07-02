import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const { recordLead } = await import("~/server/leads");
    return recordLead(data);
  });

interface WaitlistFormProps {
  source: string;
  onDone?: () => void;
}

export function WaitlistForm({ source, onDone }: WaitlistFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const company = String(form.get("company") ?? ""); // honeypot
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      await joinWaitlist({
        data: { email, company, source, userAgent: navigator.userAgent },
      });
      setStatus("done");
      onDone?.();
    } catch {
      setError("Something went wrong — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="waitlist-done" role="status">
        <p>You're on the list. Take the product for a spin while you wait:</p>
        <a className="mk-btn mk-btn--primary" href="/demo">
          Open the live demo →
        </a>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <label className="visually-hidden" htmlFor={`wl-email-${source}`}>
        Email address
      </label>
      <input
        id={`wl-email-${source}`}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        required
      />
      {/* Honeypot: hidden from humans, tempting to bots. */}
      <input
        className="visually-hidden"
        tabIndex={-1}
        autoComplete="off"
        name="company"
        aria-hidden="true"
      />
      <button className="mk-btn mk-btn--primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining…" : "Start free →"}
      </button>
      {error ? (
        <p className="waitlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
