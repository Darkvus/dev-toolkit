import { useAuth } from "@/features/auth/use-auth"

export function Button(props) {
  const { user } = useAuth()
  const data = useQuery({ queryKey: ["x"] })
  fetch("/track")
  return <button {...props} />
}
