export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roleLabel: string;
  isGuest: boolean;
};

export type JwtPayload = {
  sub: string;
  email: string;
  type: "access" | "refresh";
};
