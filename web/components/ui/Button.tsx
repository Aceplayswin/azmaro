import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const classes = (variant: Variant, size: Size, block?: boolean, className?: string) =>
  cn("az-btn", `az-btn-${variant}`, size === "sm" && "az-btn-sm", block && "w-full", className);

interface BaseProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  type = "button",
  ...props
}: BaseProps & ComponentProps<"button">) {
  return <button type={type} className={classes(variant, size, block, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  className,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return <Link className={classes(variant, size, block, className)} {...props} />;
}

/** Convenience aliases matching the design-system vocabulary. */
export const PrimaryButton = (props: Omit<ComponentProps<typeof Button>, "variant">) => (
  <Button variant="primary" {...props} />
);
export const SecondaryButton = (props: Omit<ComponentProps<typeof Button>, "variant">) => (
  <Button variant="secondary" {...props} />
);
