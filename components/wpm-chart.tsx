"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface WPMChartProps {
  data: Array<{ time: number; wpm: number }>;
}

export function WPMChart({ data }: WPMChartProps) {
  // Transform data for the chart - ensure we have data points for all 30 seconds with equal spacing
  const chartData = [];
  
  // Always create data points for exactly 30 seconds (0-30)
  for (let i = 0; i <= 30; i++) {
    const dataPoint = data.find(d => d.time === i);
    if (dataPoint) {
      chartData.push({ time: i, wpm: dataPoint.wpm });
    } else if (i > 0) {
      // Use the last known WPM if no data point exists for this second
      const lastDataPoint = data.filter(d => d.time < i).pop();
      chartData.push({ 
        time: i, 
        wpm: lastDataPoint?.wpm || 0 
      });
    } else {
      chartData.push({ time: i, wpm: 0 });
    }
  }

  // Custom tooltip to show formatted WPM
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { time: number; wpm: number }; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded px-3 py-2 shadow-lg">
          <p className="text-sm text-muted-foreground">
            {`${payload[0].payload.time}s`}
          </p>
          <p className="text-sm font-semibold text-orange-500">
            {`${payload[0].value} WPM`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
      >
        <XAxis 
          dataKey="time" 
          stroke="#6b7280"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickFormatter={(value) => `${value}s`}
          domain={[0, 30]}
          type="number"
          ticks={[0, 5, 10, 15, 20, 25, 30]}
        />
        <YAxis 
          stroke="#6b7280"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="wpm" 
          stroke="#ff6b35" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#ff6b35' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

