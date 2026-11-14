import { cn } from "@/lib/utils"

export const Row = ({ active }) => <div className={cn("row", active && "active")} />
