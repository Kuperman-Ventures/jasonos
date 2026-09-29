import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[2px] border border-transparent bg-clip-padding text-sm whitespace-nowrap transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)] disabled:pointer-events-none disabled:opacity-[0.45] aria-invalid:border-[var(--jos-danger)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground hover:bg-[var(--color-accent-800)]",
        outline:
          "border-[var(--color-text)] bg-transparent font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] aria-expanded:bg-[var(--color-surface)]",
        secondary:
          "border-[var(--color-text)] bg-transparent font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] aria-expanded:bg-[var(--color-surface)]",
        ghost:
          "font-medium hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] aria-expanded:bg-[var(--color-surface)]",
        destructive:
          "bg-[var(--color-accent-2-700)] font-semibold text-white hover:bg-[var(--color-accent-2-800)]",
        link: "font-medium text-[var(--color-accent-700)] underline underline-offset-2 hover:text-[var(--color-accent-800)]",
      },
      size: {
        default: "h-10 gap-1.5 px-3",
        xs: "h-8 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 gap-1 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 gap-1.5 px-3",
        icon: "size-10",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const nativeButton =
    props.nativeButton ?? (props.render ? false : undefined)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton}
      {...props}
    />
  )
}

export { Button, buttonVariants }
