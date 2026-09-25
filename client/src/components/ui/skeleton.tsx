import { cn } from "@/lib/utils"

/**
 * Loading placeholder. One slow shimmer sweep (see index.css) over the muted
 * base, so every skeleton in the app animates the same way.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("animate-shimmer rounded-md bg-muted", className)}
      style={{
        ...props.style,
        backgroundImage:
          "linear-gradient(100deg, transparent 25%, oklch(1 0 0 / 0.07) 50%, transparent 75%)",
        backgroundSize: "220% 100%",
        backgroundRepeat: "no-repeat",
      }}
    />
  )
}

export { Skeleton }
