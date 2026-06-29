/**
 * Self-contained command-palette host.
 *
 * Registers the `mod+k` (Cmd/Ctrl+K) shortcut, builds the default command
 * list, and renders {@link CommandPalette}. Mount it INSIDE the app
 * providers (it uses i18n + the router) - see App.tsx.
 */
import {useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useI18n} from "../hooks/useI18n";
import {useTheme} from "../hooks/useTheme";
import {useKeyboardShortcuts, type Shortcut} from "../hooks/useKeyboardShortcuts";
import CommandPalette from "./CommandPalette";
import {buildDefaultCommands} from "../utils/defaultCommands";

export interface CommandPaletteHostProps {
  /** Opens the keyboard-shortcut cheatsheet (owned by App). */
  onShowShortcuts: () => void;
}

export default function CommandPaletteHost({onShowShortcuts}: CommandPaletteHostProps) {
  const {t} = useI18n();
  const navigate = useNavigate();
  const {toggle: toggleTheme} = useTheme();
  const [open, setOpen] = useState(false);

  const shortcuts = useMemo<Shortcut[]>(
    () => [{keys: "mod+k", handler: () => setOpen((current) => !current), label: "Open command palette"}],
    [],
  );
  useKeyboardShortcuts(shortcuts);

  const commands = useMemo(
    () => buildDefaultCommands({t, navigate, toggleTheme, onShowShortcuts}),
    [t, navigate, toggleTheme, onShowShortcuts],
  );

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      commands={commands}
      placeholder={t("ui.cmd.placeholder", "Befehl oder Seite suchen...")}
    />
  );
}
