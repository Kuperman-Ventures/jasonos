import type { Metadata } from "next";
import "./post-master.css";

export const metadata: Metadata = {
  title: "Post Master · JasonOS",
  description:
    "Turn a rough idea into a LinkedIn post and blog draft in your own voice.",
};

export default function PostMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="post-master">{children}</div>;
}
