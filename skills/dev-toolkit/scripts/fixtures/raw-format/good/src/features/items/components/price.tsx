import { formatMoney } from "@/lib/format"

export function Price({ priceCents, progress_percent }: Props) {
  const width = progress_percent / 100
  return <span style={{ width }}>{formatMoney(priceCents, "EUR")}</span>
}
