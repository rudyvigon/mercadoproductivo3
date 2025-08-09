"use client";

import React, { useRef } from "react";
import styles from "./tilt-card.module.css";
import { cn } from "@/lib/utils";

export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  maxTilt?: number; // grados
  scale?: number;
  perspective?: number;
}

export default function TiltCard({
  className,
  children,
  maxTilt = 8,
  scale = 1.02,
  perspective = 800,
  ...rest
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  let frame = 0 as number | null as any;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;
    const tiltX = (maxTilt / 2 - px * maxTilt).toFixed(2);
    const tiltY = (py * maxTilt - maxTilt / 2).toFixed(2);

    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      el.style.transform = `perspective(${perspective}px) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scale})`;
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
    });
  };

  return (
    <div
      ref={ref}
      className={cn(styles.tilt, className)}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
