import axios from "axios"

export async function load() {
  const res = await fetch("/api/items")
  return res.json()
}
