export const ADMIN_ROLE_LABEL = "Admin";

export function isAdminRole(roleLabel: string | null | undefined): boolean {
  return roleLabel === ADMIN_ROLE_LABEL;
}
