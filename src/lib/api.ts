// The one way screens talk to the backend. Calls go to our own /api proxy (see app/api/[...path]/route.ts).
export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;
type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; query?: Query };
export type Reply<T> = { data: T; count?: number; message: string };

const FALLBACK = "Something went wrong. Try again.";

export async function api<T = unknown>(path: string, { method = "GET", body, query }: Options = {}): Promise<Reply<T>> {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])))
    : "";
  const res = await fetch(`/api/${path}${qs}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({ status: 0, message: FALLBACK }));
  if (!res.ok || json.status !== 1) {
    const expired = res.status === 401 || (res.status === 403 && /expired token/i.test(json.message ?? ""));
    if (expired && !path.startsWith("vendor/auth/") && typeof window !== "undefined") window.location.assign("/login");
    throw new ApiError(json.message || FALLBACK, res.status, json.data);
  }
  return { data: json.data as T, count: json.count, message: json.message };
}

// What uploads/presign accepts: the backend (controller/common/uploads) takes JPG, PNG, WebP, HEIC and PDF up to 10 MB in
// every folder. A profile photo is shown in browsers, so it takes the image types browsers can all show.
export const UPLOAD_MAX_MB = 10;
const EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf" };
export const FILES = {
  photo: { types: ["image/jpeg", "image/png", "image/webp"], accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", words: "JPG, PNG or WebP" },
  // Stripe's own limits (POST vendor/payouts/document): an ID is a JPG or PNG; proof of address may also be a PDF.
  idPhoto: { types: ["image/jpeg", "image/png"], accept: "image/jpeg,image/png,.jpg,.jpeg,.png", words: "JPG or PNG" },
  proof: { types: ["image/jpeg", "image/png", "application/pdf"], accept: "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf", words: "JPG, PNG or PDF" },
  document: { types: Object.values(EXT), accept: "image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf", words: "JPG, PNG, WebP, HEIC or PDF" },
};
export type FileKind = keyof typeof FILES;
/** The rule shown under a file slot before anything is picked. */
export const fileRule = (kind: FileKind) => `${FILES[kind].words}, up to ${UPLOAD_MAX_MB} MB.`;
/** Browsers often leave a HEIC file's type empty, so the extension decides then. */
const typeOf = (f: File) => f.type || EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";
/** Why this file can't be sent for this kind of slot, or undefined when it can. Checked before asking for an upload link. */
export function fileError(f: File, kind: FileKind) {
  if (!FILES[kind].types.includes(typeOf(f))) return `Use a ${FILES[kind].words} file.`;
  if (f.size > UPLOAD_MAX_MB * 1024 * 1024) return `This file is ${Math.ceil(f.size / 1024 / 1024)} MB. Use a file up to ${UPLOAD_MAX_MB} MB.`;
  if (!f.size) return "This file is empty. Choose another one.";
}

// Presigned upload straight to S3 (the file never passes through our servers).
export async function upload(file: File, folder: "profile" | "documents" | "jobs"): Promise<string> {
  const type = typeOf(file);
  const { data } = await api<{ uploadUrl: string; fileUrl: string }>("uploads/presign", {
    method: "POST",
    body: { folder, contentType: type, size: file.size },
  });
  const put = await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "content-type": type } });
  if (!put.ok) throw new ApiError("The upload didn't finish. Try again.", put.status);
  return data.fileUrl;
}
