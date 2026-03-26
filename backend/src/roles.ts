export const ROLE_ADMIN = "Admin";
export const ROLE_MEMBER = "Community Member";
export const ROLE_GUEST = "Guest";

export function isAdminRole(roleLabel: string | null | undefined): boolean {
  return roleLabel === ROLE_ADMIN;
}
