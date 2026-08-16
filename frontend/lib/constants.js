/**
 * lib/constants.js — Shared application constants
 *
 * Single source of truth for API base URL and any other
 * values used across multiple lib/hook/component files.
 */

/** Backend API base URL — set NEXT_PUBLIC_API_URL in .env.local to override. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** Supported file extensions for the upload dropzone. */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
];

/** Max upload size in MB (must match backend MAX_FILE_SIZE_MB). */
export const MAX_UPLOAD_SIZE_MB = 50;

/** App route paths — keep navigation links DRY. */
export const ROUTES = {
  home: "/",
  chat: "/chat",
  upload: "/upload",
  github: "/github",
  knowledge: "/knowledge",
  admin: "/admin",
};

/** Return auth headers if NEXT_PUBLIC_API_KEY is configured. */
export function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (process.env.NEXT_PUBLIC_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`;
  }
  return headers;
}
