import { toUtcIso } from "@/lib/format"

export const body = { starts_at: toUtcIso(new Date()), day: new Date().toISOString().slice(0, 10) }
