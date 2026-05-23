import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {ChevronLeft, Home} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import HelpSidebar from "../components/help/HelpSidebar";
import HelpContent from "../components/help/HelpContent";
import {loadNav, loadPage, type HelpNavItem} from "../help/loader";
import {useI18n} from "../hooks/useI18n";
import styles from "./Help.module.css";

const DEFAULT_SLUG = "getting-started";

export default function Help() {
    const navigate = useNavigate();
    const location = useLocation();
    const {t, lang} = useI18n();
    const [nav, setNav] = useState<HelpNavItem[]>([]);
    const [content, setContent] = useState<string>("");
    const [activeSlug, setActiveSlug] = useState<string>(DEFAULT_SLUG);

    useEffect(() => {
        const hash = location.hash.replace(/^#/, "");
        setActiveSlug(hash || DEFAULT_SLUG);
    }, [location.hash]);

    useEffect(() => {
        loadNav(lang).then(setNav).catch(() => setNav([]));
    }, [lang]);

    useEffect(() => {
        loadPage(lang, activeSlug).then((page) => {
            if (page) {
                setContent(page.content);
            } else {
                setContent(`# ${t("ui.help.not_found", "Page not found")}\n\n\`${activeSlug}\``);
            }
        }).catch(() => {
            setContent(`# ${t("ui.help.not_found", "Page not found")}\n\n\`${activeSlug}\``);
        });
    }, [lang, activeSlug, t]);

    const handleBack = () => {
        if (location.key === "default") navigate("/");
        else navigate(-1);
    };

    const handleSelect = (slug: string) => {
        navigate(`/help#${slug}`);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.headerLeft}>
                        <button
                            className={styles.backBtn}
                            onClick={handleBack}
                            data-testid="help-nav-back"
                            aria-label={t("ui.dashboard.back", "Back")}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h1 className={styles.title}>{t("ui.help.title", "Help")}</h1>
                    </div>
                    <nav className="icon-row" aria-label={t("ui.help.page_nav", "Help page navigation")}>
                        <button
                            className="btn-icon"
                            onClick={() => navigate("/")}
                            title={t("ui.dashboard.title", "Dashboard")}
                        >
                            <Home size={18} />
                        </button>
                        <ThemeToggle />
                    </nav>
                </div>
            </header>

            <div className={styles.body}>
                <aside className={styles.sidebar} data-testid="help-sidebar">
                    <HelpSidebar items={nav} activeSlug={activeSlug} onSelect={handleSelect} />
                </aside>
                <main id="main-content" tabIndex={-1} className={styles.content} data-testid="help-page-content">
                    <HelpContent content={content} onInternalLink={handleSelect} />
                </main>
            </div>
        </div>
    );
}
