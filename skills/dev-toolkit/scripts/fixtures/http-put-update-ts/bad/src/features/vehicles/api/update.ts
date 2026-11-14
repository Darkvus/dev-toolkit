export function updateVehicle(id: string, body: unknown) {
  return request(`/vehicles/${id}`, { method: "PUT", body })
}
