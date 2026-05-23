import {useCallback} from "react";
import {useNavigate} from "react-router-dom";

export function useHelpNav(): (slug: string) => void {
    const navigate = useNavigate();
    return useCallback(
        (slug: string) => {
            navigate(`/help#${slug}`);
        },
        [navigate],
    );
}
