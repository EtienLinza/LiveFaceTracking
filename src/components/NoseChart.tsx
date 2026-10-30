// Chart panel, split into its own chunk so chart.js is only downloaded once
// tracking has produced data (it is never needed to render the app shell).
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { FaceData } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Static options: chart.js animates every update, which is far too expensive at
// the rate tracking data arrives on a phone.
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  elements: { point: { radius: 0 } },
  plugins: {
    legend: { labels: { color: '#64748b', boxWidth: 10, boxHeight: 10 } },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', maxTicksLimit: 6, autoSkip: true },
      grid: { color: 'rgba(148, 163, 184, 0.12)' },
    },
    y: {
      ticks: { color: '#94a3b8', maxTicksLimit: 6 },
      grid: { color: 'rgba(148, 163, 184, 0.12)' },
    },
  },
};

interface NoseChartProps {
  history: FaceData[];
}

export default function NoseChart({ history }: NoseChartProps) {
  const chartData = useMemo(
    () => ({
      labels: history.map((_, i) => i),
      datasets: [
        {
          label: 'Nose X',
          data: history.map(d => Math.round(d.nose_x)),
          borderColor: '#14b8a6',
          backgroundColor: 'rgba(20, 184, 166, 0.12)',
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'Nose Y',
          data: history.map(d => Math.round(d.nose_y)),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    }),
    [history],
  );

  return <Line data={chartData} options={chartOptions} />;
}
