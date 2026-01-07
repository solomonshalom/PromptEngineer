import { WPMChart } from "@/components/wpm-chart";

interface WPMChartWrapperProps {
  data: Array<{ time: number; wpm: number }>;
}

export function WPMChartWrapper({ data }: WPMChartWrapperProps) {
  return <WPMChart data={data} />;
}

