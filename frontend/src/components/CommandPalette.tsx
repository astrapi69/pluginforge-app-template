/**
 * Command palette (Cmd/Ctrl+K).
 *
 * A searchable overlay to jump to routes and run quick actions. Lightweight
 * custom overlay rather than a Radix Dialog: the portal + focus-scope of
 * Radix is brittle under happy-dom (see .claude/rules/lessons-learned.md),
 * and a command palette needs precise keyboard control anyway.
 *
 * Keyboard: type to filter, Up/Down to move, Enter to run, Esc to close.
 * Open/close is controlled by the parent (App registers the `mod+k`
 * shortcut). The `commands` list is supplied by the caller.
 */
import {useEffect, useMemo, useRef, useState} from "react";
import {Search, type LucideIcon} from "lucide-react";
import styles from "./CommandPalette.module.css";

export interface Command {
  id: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}

export default function CommandPalette({open, onClose, commands, placeholder}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusId);
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const runAt = (index: number) => {
    const command = filtered[index];
    if (!command) return;
    command.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(selected);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose} data-testid="command-palette-backdrop">
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label={placeholder ?? "Command palette"}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        data-testid="command-palette"
      >
        <div className={styles.searchRow}>
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder ?? "Suchen..."}
            data-testid="command-palette-input"
          />
        </div>
        <ul className={styles.list} role="listbox">
          {filtered.length === 0 ? (
            <li className={styles.empty} data-testid="command-palette-empty">—</li>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <li key={command.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === selected}
                    className={styles.item}
                    data-active={index === selected}
                    data-testid={`command-${command.id}`}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => runAt(index)}
                  >
                    {Icon ? <Icon size={16} aria-hidden /> : null}
                    <span>{command.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
