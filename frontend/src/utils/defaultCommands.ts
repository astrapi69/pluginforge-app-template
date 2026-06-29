/**
 * Default command-palette entries: jump to the app's routes + a couple of
 * quick actions. Template-neutral starting point - edit the list (and the
 * routes) for your app. Kept as a pure builder so it is testable without
 * mounting the palette.
 */
import {FileText, HelpCircle, Keyboard, LayoutDashboard, Moon, Settings} from "lucide-react";
import type {Command} from "../components/CommandPalette";

export interface DefaultCommandDeps {
  t: (key: string, fallback: string) => string;
  navigate: (to: string) => void;
  toggleTheme: () => void;
  onShowShortcuts: () => void;
}

export function buildDefaultCommands({t, navigate, toggleTheme, onShowShortcuts}: DefaultCommandDeps): Command[] {
  return [
    {
      id: "nav-dashboard",
      label: t("ui.cmd.dashboard", "Zum Dashboard"),
      icon: LayoutDashboard,
      keywords: "home start",
      run: () => navigate("/"),
    },
    {
      id: "nav-articles",
      label: t("ui.cmd.articles", "Artikel"),
      icon: FileText,
      keywords: "posts list",
      run: () => navigate("/articles"),
    },
    {
      id: "nav-settings",
      label: t("ui.cmd.settings", "Einstellungen"),
      icon: Settings,
      keywords: "config preferences options",
      run: () => navigate("/settings"),
    },
    {
      id: "nav-help",
      label: t("ui.cmd.help", "Hilfe"),
      icon: HelpCircle,
      keywords: "docs documentation",
      run: () => navigate("/help"),
    },
    {
      id: "action-theme",
      label: t("ui.cmd.toggle_theme", "Hell/Dunkel umschalten"),
      icon: Moon,
      keywords: "dark light mode appearance",
      run: toggleTheme,
    },
    {
      id: "action-shortcuts",
      label: t("ui.cmd.shortcuts", "Tastaturkürzel anzeigen"),
      icon: Keyboard,
      keywords: "keys hotkeys",
      run: onShowShortcuts,
    },
  ];
}
