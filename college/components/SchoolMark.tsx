"use client";

import { useState } from "react";
import Image from "next/image";
import { schoolFaviconUrl, schoolMark } from "@/lib/types";

export function SchoolMark({ name, website }: { name: string; website: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? "" : schoolFaviconUrl(website);
  if (!src) {
    return (
      <span className="school-mark" aria-hidden="true">
        {schoolMark(name)}
      </span>
    );
  }
  return (
    <span className="school-mark" aria-hidden="true">
      <Image src={src} alt="" width={22} height={22} unoptimized onError={() => setBroken(true)} />
    </span>
  );
}
