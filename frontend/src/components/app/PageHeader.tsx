import type { ReactNode } from "react";

interface PageHeaderProps {
  /** The page's own name — matches its nav label. */
  readonly title: string;
  /** One line of context. Not a paragraph. */
  readonly context?: string;
  /** At most one primary action, right-aligned. */
  readonly action?: ReactNode;
}

/**
 * One header for every page: title, a line of context, at most one action.
 * The consistency is most of what makes an app feel calm — so this component
 * deliberately offers no way to add a second action or a longer lede.
 */
export function PageHeader({ title, context, action }: PageHeaderProps) {
  return (
    <header className="app-page-header">
      <div>
        <h1>{title}</h1>
        {context ? <p>{context}</p> : null}
      </div>
      {action ? <div className="app-page-header__action">{action}</div> : null}
    </header>
  );
}
