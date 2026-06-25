import { CATEGORY_MAP } from "@/constants/categories";

export default function StampBadge({ categoryId, variant = "red" }) {
    const label = CATEGORY_MAP[categoryId] || categoryId;
    const cls = variant === "blue" ? "stamp stamp-blue" : variant === "ink" ? "stamp stamp-ink" : "stamp";
    return <span className={cls} data-testid={`stamp-${categoryId}`}>{label}</span>;
}
