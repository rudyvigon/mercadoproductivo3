"use client";

import React, { useRef } from "react";
import styles from "./spotlight-card.module.css";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string; // e.g. "rgba(0, 229, 255, 0.2)"
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.25)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    divRef.current.style.setProperty("--mouse-x", `${x}px`);
    divRef.current.style.setProperty("--mouse-y", `${y}px`);
    divRef.current.style.setProperty("--spotlight-color", spotlightColor);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={cn(styles.cardSpotlight, className)}
    >
      {children}
    </div>
  );
}
