import { Link } from "react-router-dom";

/**
 * Renders whisper content with #hashtags turned into clickable Links.
 * Splits on the hashtag regex while preserving order.
 */
const HASHTAG_RE = /(#[\wçğıöşüÇĞİÖŞÜ]{2,30})/g;

export default function HashtagText({ children }) {
    const text = String(children || "");
    const parts = text.split(HASHTAG_RE);
    return (
        <>
            {parts.map((p, idx) => {
                if (idx % 2 === 1 && p.startsWith("#")) {
                    const tag = p.slice(1).toLowerCase();
                    return (
                        <Link
                            key={idx}
                            to={`/etiket/${encodeURIComponent(tag)}`}
                            className="text-stamp hover:underline"
                            data-testid={`hashtag-link-${tag}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {p}
                        </Link>
                    );
                }
                return p;
            })}
        </>
    );
}
