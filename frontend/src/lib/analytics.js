import { api } from "@/lib/api";

export function trackEvent(name, metadata = {}) {
    if (typeof window === "undefined") return;
    api.post("/analytics/event", {
        event_type: "feature",
        name,
        path: `${window.location.pathname}${window.location.search}`,
        metadata,
    }).catch(() => {});
}

export function trackPageView(path) {
    api.post("/analytics/event", {
        event_type: "page_view",
        name: "page_view",
        path,
    }).catch(() => {});
}
