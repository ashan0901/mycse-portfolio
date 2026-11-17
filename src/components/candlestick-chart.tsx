"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  BarSeries,
} from "lightweight-charts";
import type { Candle } from "@/types";

type ChartType = "candlestick" | "line" | "bar";

export function CandlestickChart({
  candles,
  height = 360,
  type = "candlestick",
}: {
  candles: Candle[];
  height?: number;
  type?: ChartType;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      width: container.clientWidth,
      height,
      grid: {
        vertLines: { color: "rgba(128,128,128,0.12)" },
        horzLines: { color: "rgba(128,128,128,0.12)" },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
    });

    const upColor = "#16a34a";
    const downColor = "#dc2626";

    if (type === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
      series.setData(
        candles.map((c) => ({
          time: Math.floor(c.time / 1000) as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else if (type === "line") {
      const series = chart.addSeries(LineSeries, { color: "#2563eb", lineWidth: 2 });
      series.setData(candles.map((c) => ({ time: Math.floor(c.time / 1000) as any, value: c.close })));
    } else {
      const series = chart.addSeries(BarSeries, { upColor, downColor });
      series.setData(
        candles.map((c) => ({
          time: Math.floor(c.time / 1000) as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, height, type]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}