import { useQuery } from "@tanstack/react-query";
import { type UserPermissions, ADMIN_PERMISSIONS } from "@shared/schema";
import { useAuth } from "./use-auth";

export function usePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery<UserPermissions>({
    queryKey: ["/api/auth/me/permissions"],
    enabled: !!user,
  });

  const hasPermission = (key: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (!permissions) return false;
    return !!permissions[key];
  };

  return {
    permissions: user?.role === "admin" ? ADMIN_PERMISSIONS : permissions,
    hasPermission,
    isLoading: isLoading && !!user,
  };
}
