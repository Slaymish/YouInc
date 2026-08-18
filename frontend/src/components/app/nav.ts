import type { ReactElement } from "react";
import {
  AccountsIcon,
  ActivityIcon,
  HomeIcon,
  NetWorthIcon,
  PinboardIcon,
  SettingsIcon,
  SpendingIcon,
  WorkshopIcon,
} from "~/components/dashboard/icons";

export interface AppNavItem {
  readonly to: string;
  readonly label: string;
  /** The question this page answers — shown in the side nav, not the tab bar. */
  readonly question: string;
  readonly Icon: (props: { size?: number; className?: string }) => ReactElement;
  /** Match only the exact path (the index route, which every path prefixes). */
  readonly exact?: boolean;
}

/** `/app` for a real instance, `/demo` for the signed-out copy on sample data. */
export type NavBase = "/app" | "/demo";

/**
 * The everyday layer — nav organised by question, not by data shape (see the
 * interface plan §04). This is also the mobile tab bar, so it is capped at
 * five: Xero, Trade Me, Google Drive and Health all put their fixed
 * destinations in a bottom bar and put everything else behind an account menu.
 *
 * The demo runs the same five so what people try is what they get.
 */
export function everydayNav(base: NavBase): readonly AppNavItem[] {
  return [
    { to: base, label: "Home", question: "Am I OK?", Icon: HomeIcon, exact: true },
    {
      to: `${base}/spending`,
      label: "Spending",
      question: "Where is it going?",
      Icon: SpendingIcon,
    },
    {
      to: `${base}/net-worth`,
      label: "Net worth",
      question: "Am I getting richer?",
      Icon: NetWorthIcon,
    },
    {
      to: `${base}/activity`,
      label: "Activity",
      question: "What happened?",
      Icon: ActivityIcon,
    },
    {
      to: `${base}/accounts`,
      label: "Accounts",
      question: "Where your money sits",
      Icon: AccountsIcon,
    },
  ];
}

/**
 * The long tail: never a tab, always below the divider on desktop and behind
 * the account menu on a phone. Workshop is the door to the ledger's machinery —
 * marked, opt-in, and deliberately not part of the everyday layer. The pinboard
 * sits here too: somewhere you go deliberately, not one of the daily rounds.
 */
export const SECONDARY_NAV: readonly AppNavItem[] = [
  {
    to: "/app/pinboard",
    label: "Pinboard",
    question: "Whatever you want to watch",
    Icon: PinboardIcon,
  },
  {
    to: "/app/settings",
    label: "Settings",
    question: "Appearance and your account",
    Icon: SettingsIcon,
  },
  {
    to: "/app/workshop",
    label: "Workshop",
    question: "Rules, mappings and sync log",
    Icon: WorkshopIcon,
  },
];

export const EVERYDAY_NAV = everydayNav("/app");
