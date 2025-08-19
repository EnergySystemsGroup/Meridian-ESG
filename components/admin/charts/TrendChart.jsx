import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PropTypes from 'prop-types';
import { chartColors } from '@/lib/utils/chartColors';
import { ChartErrorBoundary } from './ChartErrorBoundary';

/**
 * Reusable trend chart component for displaying time-series data
 */
export function TrendChart({ 
  data, 
  dataKey, 
  xAxisKey = 'name', 
  color = chartColors.primary,
  title,
  yAxisLabel,
  formatValue,
  height = 300 
}) {
  // Input validation
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  if (!dataKey || typeof dataKey !== 'string') {
    console.warn('TrendChart: dataKey must be a non-empty string');
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-red-500">Chart configuration error</p>
      </div>
    );
  }
  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0 && payload[0]) {
      const value = payload[0].value;
      const formattedValue = formatValue ? formatValue(value) : value;
      
      return (
        <div className="rounded-lg shadow-lg p-3" style={{ 
          backgroundColor: chartColors.background.tooltip,
          border: `1px solid ${chartColors.background.tooltipBorder}`
        }}>
          <p className="text-sm" style={{ color: chartColors.text.secondary }}>{label}</p>
          <p className="text-sm font-semibold" style={{ color }}>
            {yAxisLabel}: {formattedValue}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartErrorBoundary height={height} title={title}>
      <div className="w-full">
        {title && (
          <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
        <LineChart 
          data={data} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          role="img"
          aria-label={`Line chart${title ? ` showing ${title}` : ''}${yAxisLabel ? ` with ${yAxisLabel} values` : ''}`}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.background.grid} />
          <XAxis 
            dataKey={xAxisKey}
            tick={{ fontSize: 12 }}
            stroke={chartColors.text.secondary}
            aria-label="X-axis"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke={chartColors.text.secondary}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            aria-label={yAxisLabel || "Y-axis"}
          />
          <Tooltip content={customTooltip} />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </ChartErrorBoundary>
  );
}

TrendChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  dataKey: PropTypes.string.isRequired,
  xAxisKey: PropTypes.string,
  color: PropTypes.string,
  title: PropTypes.string,
  yAxisLabel: PropTypes.string,
  formatValue: PropTypes.func,
  height: PropTypes.number
};