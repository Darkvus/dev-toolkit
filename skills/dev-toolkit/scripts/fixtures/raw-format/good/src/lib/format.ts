export const formatMoney = (cents: number) => new Intl.NumberFormat().format(cents / 100)
export const when = (d: Date) => d.toLocaleDateString()
