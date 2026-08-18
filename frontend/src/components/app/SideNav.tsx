import { Link } from "@tanstack/react-router";
import type { AppNavItem } from "./nav";

function NavLink({ item, showQuestion }: { item: AppNavItem; showQuestion: boolean }) {
  return (
    <Link
      className="app-nav__link"
      to={item.to}
      activeOptions={item.exact ? { exact: true } : undefined}
      activeProps={{
        className: "app-nav__link app-nav__link--active",
        "aria-current": "page",
      }}
    >
      <item.Icon className="app-nav__icon" />
      <span className="app-nav__text">
        <span className="app-nav__label">{item.label}</span>
        {showQuestion ? (
          <span className="app-nav__question">{item.question}</span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Desktop side navigation. Fixed — no drag handles, nothing to configure, so
 * the same destination is always in the same place.
 */
export function SideNav({
  everyday,
  secondary,
}: {
  readonly everyday: readonly AppNavItem[];
  readonly secondary: readonly AppNavItem[];
}) {
  return (
    <nav className="app-nav" aria-label="Sections">
      <ul className="app-nav__list">
        {everyday.map((item) => (
          <li key={item.to}>
            <NavLink item={item} showQuestion />
          </li>
        ))}
      </ul>
      {secondary.length > 0 ? (
        <>
          <hr className="app-nav__rule" />
          <ul className="app-nav__list">
            {secondary.map((item) => (
              <li key={item.to}>
                <NavLink item={item} showQuestion={false} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  );
}

/**
 * Mobile bottom tab bar — the everyday destinations only. Bottom tabs rather
 * than a drawer because that is what the apps this borrows from do on a phone
 * (Xero, Trade Me, Drive, Health); a drawer hides the whole structure behind a
 * tap. The long tail lives in the account menu instead.
 */
export function TabBar({ items }: { readonly items: readonly AppNavItem[] }) {
  return (
    <nav className="app-tabbar" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.to}
          className="app-tabbar__link"
          to={item.to}
          activeOptions={item.exact ? { exact: true } : undefined}
          activeProps={{
            className: "app-tabbar__link app-tabbar__link--active",
            "aria-current": "page",
          }}
        >
          <item.Icon size={22} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
