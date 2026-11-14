// method: "PUT" in a comment is ignored
export function updateVehicle(id: string, body: unknown) {
  return request(`/vehicles/${id}`, { method: "PATCH", body })
}
