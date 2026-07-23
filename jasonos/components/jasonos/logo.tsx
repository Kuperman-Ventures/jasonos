import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

/** JasonOS brand mark — geometric play/D on dark squircle. */
export function Logo({ className, size = 24, priority = false }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="JasonOS"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-[22%]", className)}
    />
  );
}
