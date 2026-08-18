interface NoDataProps {
  /** What's missing, in a sentence. Never a shouted fragment. */
  readonly message: string;
  /** Optional second line: why it's empty, or the one thing that fills it. */
  readonly hint?: string;
}

/**
 * An empty state is the highest-attention moment in a card — the reader is
 * looking directly at something that doesn't work yet. So it says what goes
 * here and what fills it, rather than "NO DATA".
 */
export function NoData({ message, hint }: NoDataProps) {
  return (
    <div className="no-data">
      <p className="no-data__line">{message}</p>
      {hint ? <p className="no-data__hint">{hint}</p> : null}
    </div>
  );
}
