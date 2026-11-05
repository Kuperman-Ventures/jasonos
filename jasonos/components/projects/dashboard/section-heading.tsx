import styles from "./dashboard.module.css";

export function SectionHeading({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return <h2 className={className ? `${styles.heading} ${className}` : styles.heading}>{children}</h2>;
}
