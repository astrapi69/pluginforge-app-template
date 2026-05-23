import {useState} from "react";
import {ChevronRight} from "lucide-react";
import type {HelpNavItem} from "../../help/loader";

interface HelpSidebarProps {
    items: HelpNavItem[];
    activeSlug: string;
    onSelect: (slug: string) => void;
}

export default function HelpSidebar({items, activeSlug, onSelect}: HelpSidebarProps) {
    return (
        <nav data-testid="help-sidebar-nav">
            {items.map((item) => (
                <HelpSidebarItem
                    key={item.slug}
                    item={item}
                    activeSlug={activeSlug}
                    onSelect={onSelect}
                    depth={0}
                />
            ))}
        </nav>
    );
}

interface HelpSidebarItemProps {
    item: HelpNavItem;
    activeSlug: string;
    onSelect: (slug: string) => void;
    depth: number;
}

function HelpSidebarItem({item, activeSlug, onSelect, depth}: HelpSidebarItemProps) {
    const hasChildren = !!item.children?.length;
    const isParentActive = hasChildren && item.children!.some((c) => c.slug === activeSlug);
    const isActive = item.slug === activeSlug;
    const [expanded, setExpanded] = useState(isParentActive || depth === 0);

    const handleClick = () => {
        if (hasChildren) setExpanded(!expanded);
        else onSelect(item.slug);
    };

    return (
        <div>
            <button
                type="button"
                onClick={handleClick}
                data-testid={`help-sidebar-item-${item.slug}`}
                data-active={isActive ? "true" : "false"}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    textAlign: "left",
                    padding: `6px ${12 + depth * 12}px`,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "var(--accent-light, rgba(59,130,246,0.08))" : "none",
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-body)",
                }}
            >
                {hasChildren && (
                    <ChevronRight
                        size={12}
                        style={{
                            transform: expanded ? "rotate(90deg)" : "none",
                            transition: "transform 0.15s",
                            flexShrink: 0,
                        }}
                    />
                )}
                <span>{item.title}</span>
            </button>
            {hasChildren && expanded && (
                <div>
                    {item.children!.map((child) => (
                        <HelpSidebarItem
                            key={child.slug}
                            item={child}
                            activeSlug={activeSlug}
                            onSelect={onSelect}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
