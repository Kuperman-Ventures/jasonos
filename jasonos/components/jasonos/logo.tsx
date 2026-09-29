import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

/** JasonOS play mark: cyan and ink on paper. */
export function Logo({ className, size = 24, priority = false }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="JasonOS"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-[22%]", className)}
    />
  );
}
