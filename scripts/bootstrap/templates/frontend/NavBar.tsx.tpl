/**
 * ${pascal_name} top-level navigation. One link per entity. Replace
 * with a real navigation surface once the pages have UX.
 */

import {NavLink} from "react-router-dom";

const LINKS = [
${nav_entries}
];

export default function NavBar() {
    return (
        <nav data-testid="navbar">
${nav_links}
        </nav>
    );
}
