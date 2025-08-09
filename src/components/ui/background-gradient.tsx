"use client";
import React from "react";
import styles from "./background-gradient.module.css";

export type BackgroundGradientProps = {
  children?: React.ReactNode;
  className?: string;
  blending?: "screen" | "overlay" | "lighten";
  colors?: string[]; // tailwind bg-[...] classes
};

export function BackgroundGradientAnimation({
  children,
  className,
  blending = "screen",
  colors = [
    "bg-[#2E026D]",
    "bg-[#15162c]",
    "bg-[#1b97f3]",
    "bg-[#9333EA]",
    "bg-[#2563EB]",
  ],
}: BackgroundGradientProps) {
  return (
    <div className={`relative isolate overflow-hidden ${className ?? ""}`}>
      <div
        className={`${styles.container} pointer-events-none select-none`}
        style={{
          // @ts-expect-error custom var
          "--blending-value": blending,
        }}
      >
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="blurMe">
            <feGaussianBlur in="SourceGraphic" stdDeviation="80" />
          </filter>
        </svg>
        <div className={`${styles.blob} ${styles.animateFirst} ${colors[0]} w-[30vw] h-[30vw] left-[5%] top-[10%]`} />
        <div className={`${styles.blob} ${styles.animateSecond} ${colors[1]} w-[30vw] h-[30vw] left-[60%] top-[0%]`} />
        <div className={`${styles.blob} ${styles.animateThird} ${colors[2]} w-[35vw] h-[35vw] left-[40%] top-[40%]`} />
        <div className={`${styles.blob} ${styles.animateFourth} ${colors[3]} w-[30vw] h-[30vw] left-[0%] top-[50%]`} />
        <div className={`${styles.blob} ${styles.animateFifth} ${colors[4]} w-[25vw] h-[25vw] left-[70%] top-[60%]`} />
      </div>
      {children}
    </div>
  );
}
