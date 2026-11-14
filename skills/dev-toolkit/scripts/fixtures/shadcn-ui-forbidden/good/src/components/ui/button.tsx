import { cn } from "@/lib/utils"

export function Button({ className, ...props }: React.ComponentProps<"button">) {
  return <button className={cn("rounded-md", className)} {...props} />
}
