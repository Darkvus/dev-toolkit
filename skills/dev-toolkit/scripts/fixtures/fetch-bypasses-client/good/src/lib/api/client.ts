export async function apiRequest(path: string) {
  const response = await fetch(path)
  return response.json()
}
