import type { DashboardViewMeta } from "./useDashboardLayout";
import { AddIcon, RemoveIcon } from "./icons";

interface DashboardTabsProps {
  views: DashboardViewMeta[];
  activeId: string;
  isEditing: boolean;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function DashboardTabs({
  views,
  activeId,
  isEditing,
  canDelete,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: DashboardTabsProps) {
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard views">
      {views.map((view) => {
        const isActive = view.id === activeId;
        if (isActive && isEditing) {
          return (
            <span key={view.id} className="dashboard-tab dashboard-tab--editing">
              <input
                className="dashboard-tab-input"
                value={view.name}
                aria-label="View name"
                onChange={(event) => onRename(view.id, event.target.value)}
              />
              <button
                type="button"
                className="dashboard-tab-delete"
                onClick={() => onDelete(view.id)}
                disabled={!canDelete}
                aria-label={`Delete ${view.name} view`}
                title={canDelete ? "Delete view" : "Can't delete the last view"}
              >
                <RemoveIcon size={14} />
              </button>
            </span>
          );
        }
        return (
          <button
            key={view.id}
            type="button"
            className={`dashboard-tab${isActive ? " dashboard-tab--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(view.id)}
          >
            {view.name}
          </button>
        );
      })}
      <button
        type="button"
        className="dashboard-tab dashboard-tab--add"
        onClick={onAdd}
        aria-label="Add view"
        title="Add view"
      >
        <AddIcon size={14} />
      </button>
    </nav>
  );
}
