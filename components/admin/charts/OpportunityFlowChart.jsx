import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import PropTypes from 'prop-types';
import { chartColors } from '@/lib/utils/chartColors';
import { ChartErrorBoundary } from './ChartErrorBoundary';

/**
 * Pie chart component for displaying opportunity flow distribution
 */
export function OpportunityFlowChart({ 
  data, 
  title,
  height = 300,
  colors = chartColors.series 
}) {
  // Input validation
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  // Validate data structure
  const hasValidData = data.every(item => 
    item && 
    typeof item === 'object' && 
    typeof item.name === 'string' && 
    typeof item.value === 'number' && 
    item.value >= 0
  );

  if (!hasValidData) {
    console.warn('OpportunityFlowChart: data items must have name (string) and value (non-negative number)');
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-red-500">Chart data format error</p>
      </div>
    );
  }
  const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0 && payload[0]) {
      const data = payload[0].payload;
      const percentage = data.total > 0 ? ((data.value / data.total) * 100).toFixed(1) : '0.0';
      
      return (
        <div className="rounded-lg shadow-lg p-3" style={{ 
          backgroundColor: chartColors.background.tooltip,
          border: `1px solid ${chartColors.background.tooltipBorder}`
        }}>
          <p className="text-sm font-semibold" style={{ color: chartColors.text.primary }}>{data.name}</p>
          <p className="text-sm" style={{ color: chartColors.text.secondary }}>
            {data.value} opportunities ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (!percent || percent < 0.05) return null; // Hide labels for very small slices or null values
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ChartErrorBoundary height={height} title={title}>
      <div className="w-full">
        {title && (
          <h3 className="text-lg font-medium mb-4 text-center">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
        <PieChart
          role="img"
          aria-label={`Pie chart${title ? ` showing ${title}` : ''} with ${data.length} segments`}
        >
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={80}
            fill={chartColors.primary}
            dataKey="value"
            aria-label="Opportunity distribution"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={customTooltip} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>
                {value}: {entry.payload.value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
    </ChartErrorBoundary>
  );
}

OpportunityFlowChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    total: PropTypes.number
  })).isRequired,
  title: PropTypes.string,
  height: PropTypes.number,
  colors: PropTypes.arrayOf(PropTypes.string)
};