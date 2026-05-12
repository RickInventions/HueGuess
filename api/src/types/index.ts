export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_verified: boolean;
  last_username_change: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  code: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  isVerified: boolean;
}