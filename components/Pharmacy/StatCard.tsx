import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
  color?: 'blue' | 'red' | 'green' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start space-x-4">
      <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {trend && (
          <p className="text-xs mt-1 text-slate-500">{trend}</p>
        )}
      </div>
    </div>
  );
};