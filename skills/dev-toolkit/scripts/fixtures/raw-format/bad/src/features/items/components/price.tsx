export function Price({ priceCents, distanceMeters, when }: Props) {
  const label = `${(priceCents / 100).toFixed(2)} €`
  const km = distanceMeters / 1000
  return <span>{when.toLocaleDateString()} {label} {km}€{priceCents}</span>
}
