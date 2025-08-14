"use client";

import Image from "next/image";
import React from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export default function DashboardProductImage({ src, alt, className }: Props) {
  const [hidden, setHidden] = React.useState(false);
  if (!src || hidden) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center">
        {/* fallback visual, mantiene el layout */}
        <div className="h-8 w-8 rounded bg-muted-foreground/20" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className ?? "object-cover"}
      unoptimized
      onError={() => setHidden(true)}
    />
  );
}
