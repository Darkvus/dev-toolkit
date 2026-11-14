import { apiRequest } from "@/lib/api/client"

export const listItems = () => apiRequest("/items")
export const refresh = () => queryClient.refetch()
const mocked = globalThis.fetch
