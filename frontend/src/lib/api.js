import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

const TOKEN_KEY = "fisilti_session_token";

export function getSessionToken() {
    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setSessionToken(token) {
    try {
        if (token) {
            window.localStorage.setItem(TOKEN_KEY, token);
        }
    } catch {
        /* noop */
    }
}

export function clearSessionToken() {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* noop */
    }
}

api.interceptors.request.use((config) => {
    const token = getSessionToken();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            clearSessionToken();
        }
        return Promise.reject(error);
    }
);

export function formatApiError(err) {
    const detail = err?.response?.data?.detail;
    if (!detail) return err?.message || "Bir hata oluştu";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
            .filter(Boolean)
            .join(" • ");
    }
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
}
