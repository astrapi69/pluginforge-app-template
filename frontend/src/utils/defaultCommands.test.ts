import {describe, expect, it, vi} from "vitest";
import {buildDefaultCommands} from "./defaultCommands";

describe("buildDefaultCommands", () => {
  it("navigates to routes and wires the quick actions", () => {
    const navigate = vi.fn();
    const toggleTheme = vi.fn();
    const onShowShortcuts = vi.fn();
    const commands = buildDefaultCommands({
      t: (_key, fallback) => fallback,
      navigate,
      toggleTheme,
      onShowShortcuts,
    });
    const byId = (id: string) => commands.find((command) => command.id === id);

    byId("nav-settings")?.run();
    expect(navigate).toHaveBeenCalledWith("/settings");

    byId("nav-dashboard")?.run();
    expect(navigate).toHaveBeenCalledWith("/");

    byId("action-theme")?.run();
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    byId("action-shortcuts")?.run();
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);

    expect(commands.length).toBeGreaterThanOrEqual(5);
  });
});
