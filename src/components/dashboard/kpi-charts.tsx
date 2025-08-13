"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Tooltip,
} from "recharts";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function UsageRadial({
  value,
  max,
  label,
  color = "#0ea5e9",
  size = 128,
  barSize = 12,
  showCenter = true,
  layout = "inline",
}: {
  value: number;
  max: number | null;
  label: string;
  color?: string;
  size?: number;
  barSize?: number;
  showCenter?: boolean;
  layout?: "inline" | "stacked";
}) {
  const hasCap = typeof max === "number" && max > 0;
  const percent = hasCap ? clamp((value / (max as number)) * 100) : 0;
  const data = useMemo(
    () => [{ name: label, value: hasCap ? percent : 0 }],
    [label, percent, hasCap]
  );

  if (layout === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ height: size, width: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              barSize={barSize}
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                background
                dataKey="value"
                fill={hasCap ? color : "#E5E7EB"}
                cornerRadius={50}
                isAnimationActive
                animationDuration={700}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          {showCenter && (
            <div className="absolute inset-0 grid place-items-center text-center">
              <div className="text-lg font-semibold">
                {value}
                <span className="text-muted-foreground">{hasCap ? ` / ${max}` : " / ∞"}</span>
              </div>
              {hasCap && (
                <div className="text-xs text-muted-foreground">{Math.round(percent)}%</div>
              )}
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {!showCenter && (
          <>
            <div className="text-base font-semibold">
              {value}
              <span className="text-muted-foreground">{hasCap ? ` / ${max}` : " / ∞"}</span>
            </div>
            {hasCap && (
              <div className="text-xs text-muted-foreground">{Math.round(percent)}% usado</div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ height: size, width: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={barSize}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              background
              dataKey="value"
              fill={hasCap ? color : "#E5E7EB"}
              cornerRadius={50}
              isAnimationActive
              animationDuration={700}
            />
            <Tooltip formatter={(v: any) => [`${Math.round(v as number)}%`, label]} />
          </RadialBarChart>
        </ResponsiveContainer>
        {showCenter && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="text-lg font-semibold">
              {value}
              <span className="text-muted-foreground">{hasCap ? ` / ${max}` : " / ∞"}</span>
            </div>
            {hasCap && (
              <div className="text-xs text-muted-foreground">{Math.round(percent)}%</div>
            )}
          </div>
        )}
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {hasCap ? (
          <div className="text-xl font-semibold">
            {value} <span className="text-muted-foreground">/ {max}</span>
          </div>
        ) : (
          <div className="text-xl font-semibold">
            {value} <span className="text-muted-foreground">/ ∞</span>
          </div>
        )}
        {hasCap && (
          <div className="text-xs text-muted-foreground">{Math.round(percent)}% usado</div>
        )}
      </div>
    </div>
  );
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function CountdownUntil({
  targetISO,
  startISO,
  label = "Expira",
  color = "#10b981",
  size = 128,
  barSize = 12,
  layout = "inline",
  showCenter = false,
}: {
  targetISO: string | null;
  startISO?: string | null;
  label?: string;
  color?: string;
  size?: number;
  barSize?: number;
  layout?: "inline" | "stacked";
  showCenter?: boolean;
}) {
  const target = targetISO ? new Date(targetISO).getTime() : null;
  const start = startISO ? new Date(startISO).getTime() : null;

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target ? target - now : 0;
  const total = start && target ? target - start : null;
  const consumed = start ? now - start : null;
  const percent = total && consumed ? clamp((consumed / total) * 100) : 0;
  const timeLabel = target ? fmtDuration(Math.max(0, remaining)) : "—";

  const data = [{ name: label, value: percent }];

  if (layout === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ height: size, width: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              barSize={barSize}
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" fill={color} cornerRadius={50} isAnimationActive animationDuration={700} />
            </RadialBarChart>
          </ResponsiveContainer>
          {showCenter && (
            <div className="absolute inset-0 grid place-items-center text-center">
              <div className="text-lg font-semibold">{timeLabel}</div>
              <div className="text-xs text-muted-foreground">{Math.round(percent)}% del período</div>
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {!showCenter && (
          <>
            <div className="text-base font-semibold">{timeLabel}</div>
            <div className="text-xs text-muted-foreground">{Math.round(percent)}% del período</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ height: size, width: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={barSize}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" fill={color} cornerRadius={50} isAnimationActive animationDuration={700} />
          </RadialBarChart>
        </ResponsiveContainer>
        {showCenter && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="text-lg font-semibold">{timeLabel}</div>
            <div className="text-xs text-muted-foreground">{Math.round(percent)}% del período</div>
          </div>
        )}
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{timeLabel}</div>
        <div className="text-xs text-muted-foreground">{Math.round(percent)}% del período transcurrido</div>
      </div>
    </div>
  );
}
