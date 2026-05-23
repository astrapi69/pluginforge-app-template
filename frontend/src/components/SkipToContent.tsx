import {useI18n} from "../hooks/useI18n";

export default function SkipToContent() {
    const {t} = useI18n();
    return (
        <a href="#main-content" className="skip-link" data-testid="skip-to-content">
            {t("ui.common.skip_to_content", "Skip to content")}
        </a>
    );
}
