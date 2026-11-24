import { z } from "zod";
import { email, indianPhone, nonEmpty, password } from "../../validators/common";

export const registerSchema = z.object({
  name: nonEmpty("Full name", 120),
  email,
  password,
  phone: indianPhone.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
