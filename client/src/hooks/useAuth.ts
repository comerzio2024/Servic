import { useQuery } from "@tanstack/react-query";
import type { UserWithPlan } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithPlan>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
