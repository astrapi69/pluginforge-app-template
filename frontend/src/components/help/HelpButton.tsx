import {HelpCircle} from "lucide-react";
import {useHelpNav} from "../../hooks/useHelpNav";
import {useI18n} from "../../hooks/useI18n";

interface HelpButtonProps {
    slug: string;
    size?: number;
}

export default function HelpButton({slug, size = 14}: HelpButtonProps) {
    const goHelp = useHelpNav();
    const {t} = useI18n();

    return (
        <button
            type="button"
            onClick={() => goHelp(slug)}
            className="btn-icon"
            title={t("ui.help.open", "Open help")}
            data-testid={`help-button-${slug}`}
            style={{opacity: 0.5, padding: 2}}
        >
            <HelpCircle size={size} />
        </button>
    );
}
