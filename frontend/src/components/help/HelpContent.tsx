import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import {ExternalLink} from "lucide-react";

interface HelpContentProps {
    content: string;
    onInternalLink?: (slug: string) => void;
}

export default function HelpContent({content, onInternalLink}: HelpContentProps) {
    return (
        <div className="help-content" data-testid="help-content-body">
            <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug, rehypeAutolinkHeadings]}
                components={{
                    a: ({href, children, ...props}) => {
                        if (href && !href.startsWith("http") && !href.startsWith("#") && onInternalLink) {
                            return (
                                <a
                                    {...props}
                                    href={href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const slug = href.replace(/\.md$/, "").replace(/^\//, "");
                                        onInternalLink(slug);
                                    }}
                                    style={{color: "var(--accent)", cursor: "pointer"}}
                                >
                                    {children}
                                </a>
                            );
                        }
                        return (
                            <a
                                {...props}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{color: "var(--accent)"}}
                            >
                                {children}{" "}
                                <ExternalLink size={10} style={{verticalAlign: "middle"}} />
                            </a>
                        );
                    },
                }}
            >
                {content}
            </Markdown>
        </div>
    );
}
