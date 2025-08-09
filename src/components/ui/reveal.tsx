"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./reveal.module.css";
import { cn } from "@/lib/utils";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

export interface RevealProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  delayMs?: number;
  direction?: RevealDirection;
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export default function Reveal({
  children,
  className,
  as: Tag = "div",
  delayMs = 0,
  direction = "none",
  once = true,
  threshold = 0.15,
  rootMargin = "0px 0px -10% 0px",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once, threshold, rootMargin]);

  const dirClass =
    direction === "up"
      ? styles.fromDown
      : direction === "down"
      ? styles.fromUp
      : direction === "left"
      ? styles.fromLeft
      : direction === "right"
      ? styles.fromRight
      : undefined;

  return (
    <Tag
      ref={ref as any}
      className={cn(styles.base, dirClass, visible && styles.visible, className)}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </Tag>
  );
}
