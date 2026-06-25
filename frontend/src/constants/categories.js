export const CATEGORIES = [
    { id: "kahvehane", label: "Kahvehane" },
    { id: "berber", label: "Berber" },
    { id: "taksi", label: "Taksi" },
    { id: "dolmus", label: "Dolmuş" },
    { id: "market", label: "Market / Bakkal" },
    { id: "caybahcesi", label: "Çay Bahçesi" },
    { id: "lokanta", label: "Lokanta" },
    { id: "kuafor", label: "Kuaför" },
    { id: "park", label: "Park" },
    { id: "diger", label: "Diğer" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
