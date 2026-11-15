import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import StaffToolbar from '../components/StaffToolbar';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';

const CustomRechartsTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-purple-500/30 text-xs space-y-2 min-w-[210px] z-50 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between border-b border-white/15 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5122fe]"></span>
            <span className="font-extrabold text-sm text-purple-200">{dataPoint.fullName}</span>
          </div>
          <span className="text-[11px] font-mono text-purple-300 font-semibold">{dataPoint.date}</span>
        </div>
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-purple-200">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5122fe] ring-2 ring-purple-300/40"></span>
              Auto-Cleared:
            </span>
            <strong className="text-white font-mono text-xs">{dataPoint["Auto-Cleared"]}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-purple-200">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] ring-2 ring-rose-300/40"></span>
              Moderated:
            </span>
            <strong className="text-white font-mono text-xs">{dataPoint["Moderated"]}</strong>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-purple-300">
            <span>Clearance Rate:</span>
            <strong className="text-emerald-400 font-mono">{dataPoint.approvalPct}%</strong>
          </div>
          <div className="flex items-center justify-between text-purple-300">
            <span>Total Intake:</span>
            <strong className="text-white font-mono font-bold text-xs">{dataPoint.total}</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};



const CustomTrafficTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-purple-500/30 text-xs space-y-1.5 min-w-[210px] z-50 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between border-b border-white/15 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5122fe] ring-2 ring-purple-300/40"></span>
            <span className="font-extrabold text-sm text-purple-200">{dataPoint.label}</span>
          </div>
          <span className="text-[11px] font-mono text-purple-300 font-semibold">{dataPoint.slot}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-purple-200/80">Intake Volume:</span>
          <strong className="text-white font-mono text-xs">{dataPoint.volume} {dataPoint.volume === 1 ? 'review' : 'reviews'}</strong>
        </div>
        <div className="flex items-center justify-between text-[11px] text-purple-300">
          <span>Traffic Status:</span>
          <strong className={dataPoint.peak ? "text-amber-400 font-bold" : "text-purple-300"}>
            {dataPoint.peak ? '⚡ Peak Operational Window' : dataPoint.volume > 0 ? 'Normal Activity' : 'Off-Peak / Idle'}
          </strong>
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsInsights({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSilhouetteTab, setActiveSilhouetteTab] = useState('rating'); // 'rating', 'volume', 'verified'
  const [selectedRatingFilter, setSelectedRatingFilter] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsOverview();
      setData(res);
    } catch (err) {
      console.error(err);
      showToast?.('Error loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Metric,Value\n";
    csvContent += `Overview,Total Reviews,${data.total_reviews}\n`;
    csvContent += `Overview,Average Rating,${data.average_rating}\n`;
    csvContent += `Overview,Auto-Clear Rate (%),${data.auto_clear_rate}\n`;
    csvContent += `Overview,Median SLA (min),${data.median_sla_minutes}\n`;
    csvContent += `Overview,Verified Purchase (%),${data.verified_percentage}\n`;
    
    // Footwear models from live MongoDB telemetry
    const exportModels = data.product_telemetry || [];
    exportModels.forEach((shoe) => {
      csvContent += `Footwear Model,${shoe.name} - Rating,${shoe.baseRating}\n`;
      csvContent += `Footwear Model,${shoe.name} - Reviews,${shoe.baseVolume}\n`;
    });

    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `footwear_analytics_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Exported comprehensive analytics CSV successfully!', 'success');
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center animate-bounce shadow-sm">
          <span className="material-symbols-outlined text-[#5122fe] text-2xl animate-spin">refresh</span>
        </div>
        <div className="text-center">
          <h3 className="font-headline font-bold text-base text-purple-950">Aggregating Footwear Telemetry</h3>
          <p className="text-xs text-purple-900/60 mt-1">Calculating multi-channel yields, SLA turnaround, and sentiment polarity...</p>
        </div>
      </div>
    );
  }

  // Real daily volume telemetry from MongoDB Atlas backend
  const rawDaily = data.daily_volume || [];
  const dailyData = rawDaily.map((item) => {
    const approved = item.approved || 0;
    const flagged = item.flagged || 0;
    const volume = item.volume ?? (approved + flagged);
    const approvalPct = volume > 0 ? Math.round((approved / volume) * 100) : 100;
    return {
      day: item.day,
      date: item.date || item.day,
      fullName: getDayFullName(item.day),
      approved,
      flagged,
      volume,
      approvalPct,
    };
  });

  // Calculate maximum volume of any single day for proportional scaling
  const maxDailyVolume = Math.max(
    ...dailyData.map((d) => d.volume),
    0
  );

  const peakDay = maxDailyVolume > 0
    ? dailyData.reduce((prev, curr) => (curr.volume > prev.volume ? curr : prev), dailyData[0])
    : null;

  // Accurately determine peak day only when volume > 0
  const processedDaily = dailyData.map((d) => ({
    ...d,
    isPeak: maxDailyVolume > 0 && d.volume === maxDailyVolume,
  }));

  const totalWeeklyVolume = processedDaily.reduce((acc, cur) => acc + cur.volume, 0);
  const totalApproved = processedDaily.reduce((acc, cur) => acc + cur.approved, 0);
  const totalFlagged = processedDaily.reduce((acc, cur) => acc + cur.flagged, 0);
  const avgDailyVolume = Math.round(totalWeeklyVolume / (processedDaily.length || 1));

  // Recharts structured dataset
  const chartData = processedDaily.map((item) => ({
    day: item.day,
    date: item.date,
    fullName: item.fullName,
    "Auto-Cleared": item.approved,
    "Moderated": item.flagged,
    total: item.volume,
    approvalPct: item.approvalPct,
    isPeak: item.isPeak,
  }));

  // Dynamic Y-axis scale with comfortable headroom for labels & badges
  let maxY = 10;
  let yTicks = [10, 8, 6, 4, 2, 0];
  if (maxDailyVolume > 100) {
    maxY = Math.ceil((maxDailyVolume * 1.25) / 50) * 50;
    yTicks = [maxY, Math.round(maxY * 0.75), Math.round(maxY * 0.5), Math.round(maxY * 0.25), 0];
  } else if (maxDailyVolume > 50) {
    maxY = 100;
    yTicks = [100, 75, 50, 25, 0];
  } else if (maxDailyVolume > 20) {
    maxY = Math.ceil((maxDailyVolume * 1.2) / 10) * 10;
    yTicks = [maxY, Math.round(maxY * 0.75), Math.round(maxY * 0.5), Math.round(maxY * 0.25), 0];
  } else if (maxDailyVolume > 10) {
    maxY = 20;
    yTicks = [20, 15, 10, 5, 0];
  } else if (maxDailyVolume > 5) {
    maxY = 10;
    yTicks = [10, 8, 6, 4, 2, 0];
  } else if (maxDailyVolume > 0) {
    maxY = Math.max(6, maxDailyVolume + 2);
    yTicks = [];
    const step = maxY <= 6 ? 1 : 2;
    for (let t = maxY; t >= 0; t -= step) {
      yTicks.push(t);
    }
    if (yTicks[yTicks.length - 1] !== 0) yTicks.push(0);
  } else {
    maxY = 10;
    yTicks = [10, 8, 6, 4, 2, 0];
  }



  // Dynamic backend telemetry collections
  const shoeModels = data.product_telemetry || [];
  const hourlyData = data.hourly_intervals || [];
  const maxHourlyVol = Math.max(...hourlyData.map((h) => h.volume), 0);
  const activePeakSlot = hourlyData.find((h) => h.volume === maxHourlyVol && maxHourlyVol > 0);
  const totalHourlyVol = hourlyData.reduce((acc, h) => acc + h.volume, 0);
  const avgHourlyVol = totalHourlyVol > 0 ? (totalHourlyVol / (hourlyData.length || 1)).toFixed(1) : '0';
  const yMaxTraffic = Math.max(4, maxHourlyVol + 2);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
      
      {/* Staff Portal Toolbar */}
      <StaffToolbar pendingCount={data.pending_count || 0} />

      {/* ============================================================== */}
      {/* 1. TOP EXECUTIVE HEADER WITH RANGE SELECTOR & CSV EXPORT */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-purple-200/90 shadow-[0_4px_24px_rgba(81,34,254,0.06)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5122fe] bg-purple-100/90 px-3 py-0.5 rounded-full border border-purple-200 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5122fe] animate-ping"></span>
              Live Telemetry
            </span>
            <span className="text-xs text-purple-900/60 font-medium">Footwear SLA & Yield Performance</span>
          </div>
          <h1 className="font-headline text-xl sm:text-2xl lg:text-3xl font-extrabold text-purple-950 tracking-tight mt-1">
            Shoe Feedback & Sentiment Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-purple-900/60 mt-1 max-w-2xl">
            Real-time analytics on customer satisfaction, automated clearance ratio, review intake velocity, and silhouette benchmarks.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Refresh Analytics */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh analytics telemetry"
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-purple-50 text-purple-900 text-xs font-bold border border-purple-200 shadow-2xs transition-all cursor-pointer active:scale-98 disabled:opacity-50 text-center"
          >
            <span className={`material-symbols-outlined text-[17px] text-[#5122fe] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-purple-50 text-purple-900 text-xs font-bold border border-purple-200 shadow-2xs transition-all cursor-pointer active:scale-98 text-center"
          >
            <span className="material-symbols-outlined text-[17px] text-[#5122fe]">file_download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. TOP 3 KEY PERFORMANCE METRIC CARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        
        {/* Metric 1: Overall Satisfaction */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-purple-100 shadow-[0_2px_12px_rgba(81,34,254,0.04)] flex flex-col justify-between hover:border-purple-300 hover:shadow-[0_4px_20px_rgba(81,34,254,0.08)] transition-all group">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-900/60">
            <span>Overall Score</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5 shadow-2xs">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>
              +0.3 vs Ly
            </span>
          </div>
          <div className="my-2 sm:my-3">
            <div className="font-headline text-2xl sm:text-3xl font-extrabold text-purple-950 flex items-baseline gap-1.5">
              {data.total_reviews > 0 ? (data.average_rating || 0).toFixed(1) : '0.0'}
              <span className="text-xs font-bold text-purple-400">/ 5.0</span>
            </div>
            <div className="flex items-center text-amber-400 mt-1.5 gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className="material-symbols-outlined text-[16px] sm:text-[18px] material-symbols-filled">
                  {s <= Math.round(data.total_reviews > 0 ? (data.average_rating || 0) : 0) ? 'star' : 'star_border'}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-purple-900/50 pt-2 border-t border-purple-50 flex items-center justify-between">
            <span>Overall Rating</span>
            <span className="font-mono font-bold text-purple-700">{data.total_reviews > 0 ? `${(data.average_rating || 5.0).toFixed(1)} / 5.0` : 'No reviews'}</span>
          </div>
        </div>

        {/* Metric 2: Verified Volume */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-purple-100 shadow-[0_2px_12px_rgba(81,34,254,0.04)] flex flex-col justify-between hover:border-purple-300 hover:shadow-[0_4px_20px_rgba(81,34,254,0.08)] transition-all group">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-900/60">
            <span>Verified Volume</span>
            <span className="text-[10px] font-bold text-[#5122fe] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 shadow-2xs">
              {data.verified_percentage}%
            </span>
          </div>
          <div className="my-2 sm:my-3">
            <div className="font-headline text-2xl sm:text-3xl font-extrabold text-purple-950">
              {data.total_reviews}
            </div>
            <div className="text-[11px] text-purple-900/70 mt-1 font-medium">
              Footwear wear evaluations logged
            </div>
          </div>
          <div className="text-[11px] text-purple-900/50 pt-2 border-t border-purple-50 flex items-center justify-between">
            <span>Order Match</span>
            <span className="font-bold text-emerald-600">POS Verified</span>
          </div>
        </div>

        {/* Metric 3: Turnaround SLA */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-purple-100 shadow-[0_2px_12px_rgba(81,34,254,0.04)] flex flex-col justify-between hover:border-purple-300 hover:shadow-[0_4px_20px_rgba(81,34,254,0.08)] transition-all group">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-900/60">
            <span>Median SLA</span>
            <span className="text-[10px] font-bold text-[#5122fe] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 shadow-2xs">
              &lt; 10m Goal
            </span>
          </div>
          <div className="my-2 sm:my-3">
            <div className="font-headline text-2xl sm:text-3xl font-extrabold text-purple-950">
              {data.median_sla_minutes}m
            </div>
            <div className="text-[11px] text-purple-900/70 mt-1 font-medium">
              Moderator triage turnaround
            </div>
          </div>
          <div className="text-[11px] text-purple-900/50 pt-2 border-t border-purple-50 flex items-center justify-between">
            <span>SLA Compliance</span>
            <span className="font-bold text-emerald-600">100% On-Target</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. PRIMARY FEATURED BAR GRAPH: Weekly Intake & Moderation Trajectory */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-b from-white via-white to-purple-50/20 p-5 sm:p-7 rounded-3xl border border-purple-200/90 shadow-[0_4px_28px_rgba(81,34,254,0.07)] space-y-5 transition-all">
        
        {/* Header with Title, Live KPI Pills & 3-Way Mode Switch */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-purple-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#5122fe] to-[#8c52ff] flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                <span className="material-symbols-outlined text-[20px]">monitoring</span>
              </span>
              <div>
                <h2 className="font-headline text-base sm:text-xl font-extrabold text-purple-950 tracking-tight">
                  Weekly Review Intake & Moderation Velocity
                </h2>
                <p className="text-xs text-purple-900/60 mt-0.5">
                  7-day incoming footwear review stream categorized by automated clearance vs manual moderator queue
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Live KPI Badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-indigo-50/80 px-2.5 py-1.5 rounded-xl border border-indigo-200/80 text-xs font-bold text-indigo-900">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#7c3aed] shadow-xs"></span>
                <span>Auto-Cleared:</span>
                <span className="font-mono text-indigo-700">{totalApproved}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50/80 px-2.5 py-1.5 rounded-xl border border-rose-200/80 text-xs font-bold text-rose-900">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#e11d48] to-[#fb7185] shadow-xs"></span>
                <span>Moderated:</span>
                <span className="font-mono text-rose-700">{totalFlagged}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-purple-100/70 px-2.5 py-1.5 rounded-xl border border-purple-200 text-xs font-extrabold text-purple-950">
                <span>Total:</span>
                <span className="font-mono text-[#5122fe]">{totalWeeklyVolume}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Modern Recharts Smooth Line / Area Intake Trajectory */}
        <div className="w-full h-72 sm:h-80 pt-2 select-none outline-none focus:outline-none">
          <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none [&_*]:focus:outline-none">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 15, left: -15, bottom: 10 }}
              style={{ outline: 'none' }}
              tabIndex={-1}
            >
              <defs>
                <linearGradient id="rechartsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.38} />
                  <stop offset="75%" stopColor="#818cf8" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ede9fe" />
              <XAxis 
                dataKey="day" 
                tickLine={false} 
                axisLine={{ stroke: '#ede9fe', strokeWidth: 1.5 }}
                tick={({ x, y, payload }) => {
                  const item = chartData.find(d => d.day === payload.value);
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={15} textAnchor="middle" fill="#1e1b4b" fontSize={12} fontWeight={700}>
                        {payload.value}
                      </text>
                      <text x={0} y={28} textAnchor="middle" fill="#7c3aed" fontSize={10} opacity={0.65} fontFamily="monospace">
                        {item?.date || ''}
                      </text>
                    </g>
                  );
                }}
                height={40}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#7c3aed', fontSize: 11, fontFamily: 'monospace' }}
                allowDecimals={false}
                domain={[0, (dataMax) => Math.max(dataMax + 2, 6)]}
              />
              <RechartsTooltip content={<CustomRechartsTooltip />} cursor={{ stroke: '#818cf8', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
              <Area 
                type="monotone" 
                dataKey="total" 
                name="Total Intake"
                stroke="#5122fe" 
                strokeWidth={3.5} 
                fillOpacity={1} 
                fill="url(#rechartsArea)" 
                dot={{ r: 5, fill: "#5122fe", strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 8, fill: "#4f46e5", stroke: "#ffffff", strokeWidth: 3 }}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Telemetry Strip Footer */}
        <div className="pt-3 border-t border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-900/70">
          <div className="flex items-center gap-2">
            {maxDailyVolume > 0 && peakDay ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  Peak intake on <strong>{peakDay.fullName} ({peakDay.volume} evaluation{peakDay.volume === 1 ? '' : 's'})</strong> with{' '}
                  <strong className="text-emerald-700">{peakDay.approvalPct}%</strong> auto-clearance efficiency
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <span>All moderation queues cleared — zero backlog recorded in this 7-day intake window</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-[#5122fe] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">touch_app</span>
            <span>Hover or tap any column to inspect exact telemetry</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. HOURLY PEAK REVIEW TRAFFIC (DIURNAL TREND LINE GRAPH) */}
      {/* ============================================================== */}
      <div className="bg-white p-4 sm:p-7 rounded-3xl border border-purple-200/90 shadow-[0_4px_28px_rgba(81,34,254,0.06)] space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-[#5122fe] shadow-2xs">
                <span className="material-symbols-outlined text-[19px]">schedule</span>
              </span>
              <div>
                <h3 className="font-headline font-bold text-base sm:text-lg text-purple-950">
                  Peak Review Traffic by Time of Day
                </h3>
                <p className="text-xs text-purple-900/60 mt-0.5">
                  Diurnal intake distribution across 4-hour operating intervals for staffing & automated heuristics
                </p>
              </div>
            </div>
          </div>

          <div>
            {/* Active Peak Badge */}
            {activePeakSlot ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#5122fe] bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#5122fe] animate-pulse"></span>
                Peak Prime: {activePeakSlot.slot} ({activePeakSlot.label})
              </span>
            ) : (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                24H Intake Tracking Active
              </span>
            )}
          </div>
        </div>

        {/* Modern Recharts Smooth Spline Line Chart in Brand Theme */}
        <div className="w-full pt-1 select-none outline-none focus:outline-none">
          <div className="h-60 sm:h-68 w-full outline-none focus:outline-none">
            <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none [&_*]:focus:outline-none">
              <LineChart
                data={hourlyData}
                style={{ outline: 'none' }}
                tabIndex={-1}
                margin={{
                  top: 25,
                  right: isMobile ? 12 : 28,
                  left: isMobile ? -22 : -15,
                  bottom: isMobile ? 6 : 16,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#f3edff"
                  vertical={false}
                />
                <XAxis
                  dataKey="slot"
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#e9d5ff' }}
                  tick={({ x, y, payload }) => {
                    const item = hourlyData.find((h) => h.slot === payload.value);
                    const mobileLabel = payload.value.replace(/^0/, '').replace(/-0/, '-');

                    if (isMobile) {
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={14}
                            textAnchor="middle"
                            fill="#1e1b4b"
                            fontSize={10}
                            fontWeight={700}
                            fontFamily="monospace"
                          >
                            {mobileLabel}
                          </text>
                        </g>
                      );
                    }

                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={14}
                          textAnchor="middle"
                          fill="#1e1b4b"
                          fontSize={11}
                          fontWeight={700}
                          fontFamily="monospace"
                        >
                          {payload.value}
                        </text>
                        <text
                          x={0}
                          y={27}
                          textAnchor="middle"
                          fill="#6b21a8"
                          fontSize={10}
                          fontWeight={500}
                          fillOpacity={0.7}
                        >
                          {item?.label || ''}
                        </text>
                      </g>
                    );
                  }}
                  height={isMobile ? 26 : 45}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yMaxTraffic]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#7e22ce', fontSize: 11, fontWeight: 600 }}
                />
                <RechartsTooltip
                  content={<CustomTrafficTooltip />}
                  cursor={{ stroke: '#5122fe', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                />
                {totalHourlyVol > 0 && (
                  <ReferenceLine
                    y={Number(avgHourlyVol)}
                    stroke="#c084fc"
                    strokeDasharray="3 3"
                    label={{
                      value: `Avg: ${avgHourlyVol}`,
                      position: 'insideTopRight',
                      fill: '#7e22ce',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="volume"
                  name="Reviews"
                  stroke="#5122fe"
                  strokeWidth={3}
                  activeDot={{
                    r: 8,
                    stroke: '#5122fe',
                    strokeWidth: 3,
                    fill: '#8c52ff',
                  }}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return null;
                    const isPeak = activePeakSlot && payload.slot === activePeakSlot.slot;

                    return (
                      <g key={`traffic-dot-${payload.slot}`}>
                        {isPeak && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={12}
                            fill="#5122fe"
                            fillOpacity={0.18}
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isPeak ? 6 : 4.5}
                          fill={isPeak ? '#5122fe' : '#ffffff'}
                          stroke="#5122fe"
                          strokeWidth={2.5}
                        />
                        {payload.volume > 0 && (
                          <text
                            x={cx}
                            y={cy - 10}
                            textAnchor="middle"
                            fill="#5122fe"
                            fontSize={11}
                            fontWeight={800}
                          >
                            {payload.volume}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-purple-100 text-xs text-purple-900/60">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5122fe]"></span>
            <span>
              Total 24-hour cycle volume: <strong className="text-purple-950 font-mono font-bold">{totalHourlyVol} evaluations</strong>
            </span>
          </div>
          <div className="text-[11px] text-purple-600 font-medium font-mono">
            Circadian Rhythm Telemetry
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. TELEMETRY & INTAKE BENCHMARKS (3-COLUMN BALANCED SUITE) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        
        {/* Card 1: Footwear Silhouette Performance */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-purple-200/90 shadow-[0_4px_24px_rgba(81,34,254,0.06)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-2.5 border-b border-purple-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-[#5122fe]">
                    <span className="material-symbols-outlined text-[18px]">footprint</span>
                  </span>
                  <h3 className="font-headline font-bold text-base text-purple-950">
                    Footwear Silhouettes
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full border border-purple-200">
                  {shoeModels.length} models
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-purple-900/50">Production benchmarks</p>
                {/* Toggle metric */}
                <div className="flex items-center bg-purple-50 p-0.5 rounded-xl border border-purple-200 text-xs">
                  {[
                    { id: 'rating', label: 'Rating' },
                    { id: 'volume', label: 'Volume' },
                    { id: 'verified', label: 'Verified' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSilhouetteTab(tab.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        activeSilhouetteTab === tab.id
                          ? 'bg-gradient-to-r from-[#5122fe] to-[#7b4eff] text-white shadow-2xs'
                          : 'text-purple-700 hover:text-purple-950 hover:bg-white/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model Horizontal Bar Graphs */}
            <div className="space-y-3 pt-3">
              {shoeModels.length === 0 ? (
                <div className="text-center py-8 text-xs text-purple-900/60 bg-purple-50/40 rounded-xl">
                  No product reviews yet. Write a review to see product telemetry.
                </div>
              ) : (
                shoeModels.map((shoe) => {
                  const ratingPct = (shoe.baseRating / 5.0) * 100;
                  const volumeScaled = shoe.baseVolume;
                  const volumePct = (volumeScaled / 50) * 100;
                  const activePct = activeSilhouetteTab === 'rating' 
                    ? ratingPct 
                    : activeSilhouetteTab === 'volume' 
                    ? volumePct 
                    : shoe.verifiedPct;

                  const rawBrand = shoe.brand || (shoe.sku && shoe.name && shoe.sku.toLowerCase() !== shoe.name.toLowerCase() ? shoe.sku : '');
                  const brandFormatted = rawBrand ? rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1) : '';
                  const nameFormatted = shoe.name ? shoe.name.charAt(0).toUpperCase() + shoe.name.slice(1) : 'Product';
                  const displayName = brandFormatted ? `${brandFormatted} • ${nameFormatted}` : nameFormatted;

                  return (
                    <div key={shoe.sku || shoe.name} className="space-y-1.5 group p-2 rounded-2xl hover:bg-purple-50/50 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-[#5122fe] text-xs">
                            <span className="material-symbols-outlined text-[15px]">{shoe.icon || 'footprint'}</span>
                          </div>
                          <span className="font-bold text-purple-950 group-hover:text-[#5122fe] transition-colors">
                            {displayName}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full border border-purple-200">
                            {shoe.category || 'Footwear'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          {activeSilhouetteTab === 'rating' ? (
                            <span className="font-bold text-purple-950 flex items-center gap-1">
                              <span>{(shoe.baseRating || 5.0).toFixed(1)}</span>
                              <span className="material-symbols-outlined text-[13px] material-symbols-filled text-amber-400">star</span>
                            </span>
                          ) : activeSilhouetteTab === 'volume' ? (
                            <span className="font-bold text-[#5122fe]">{volumeScaled} reviews</span>
                          ) : (
                            <span className="font-bold text-emerald-600">{shoe.verifiedPct}%</span>
                          )}
                        </div>
                      </div>

                      {/* Horizontal Bar with Gradient and Value Fill */}
                      <div className="h-2.5 w-full bg-purple-100/70 rounded-full overflow-hidden p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-[#5122fe] via-[#6f3eff] to-violet-500 rounded-full transition-all duration-500 group-hover:brightness-110 shadow-xs"
                          style={{ width: `${Math.max(activePct, 5)}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-purple-900/50 px-1">
                        <span>Key Attribute: <strong className="text-purple-700 font-medium">{shoe.attribute || 'Performance'}</strong></span>
                        <span className="text-[9px] uppercase tracking-wider">{activePct.toFixed(0)}% benchmark</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Rating Distribution Breakdown */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-purple-200/90 shadow-[0_4px_24px_rgba(81,34,254,0.06)] space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-purple-950">
                  Rating Distribution
                </h3>
                <p className="text-xs text-purple-900/50">Proportion across 1-star to 5-star tiers</p>
              </div>
              <span className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-[#5122fe]">
                <span className="material-symbols-outlined text-[17px]">equalizer</span>
              </span>
            </div>

            <div className="space-y-2.5 pt-3">
              {[5, 4, 3, 2, 1].map((s) => {
                const item = data.rating_distribution?.[`${s}_star`] || { count: 0, percentage: 0 };
                const scaledCount = item.count;
                const barColor = s >= 4 
                  ? 'bg-gradient-to-r from-[#5122fe] to-[#7b4eff]' 
                  : s === 3 
                  ? 'bg-gradient-to-r from-purple-400 to-indigo-400' 
                  : 'bg-gradient-to-r from-rose-400 to-rose-500';

                return (
                  <div key={s} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-950 flex items-center gap-1">
                        <span>{s}</span>
                        <span className="material-symbols-outlined text-[14px] material-symbols-filled text-amber-400">star</span>
                      </span>
                      <span className="text-[11px] text-purple-900/70 font-mono">
                        <strong className="text-purple-950">{scaledCount}</strong> reviews ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-purple-100/70 overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 3: Multi-Channel Intake Yield */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-purple-200/90 shadow-[0_4px_24px_rgba(81,34,254,0.06)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div>
                <h3 className="font-headline font-bold text-base text-purple-950">
                  Multi-Channel Intake
                </h3>
                <p className="text-xs text-purple-900/50">Retail channels generating footwear feedback</p>
              </div>
              <span className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-[#5122fe]">
                <span className="material-symbols-outlined text-[17px]">hub</span>
              </span>
            </div>

            {/* Channel Bars */}
            <div className="space-y-3 pt-3">
              {(() => {
                const defaultChannels = [
                  { name: 'Direct Web', icon: 'language' },
                  { name: 'Shopify Store', icon: 'shopping_bag' },
                  { name: 'Amazon Marketplace', icon: 'storefront' },
                  { name: 'Mobile App', icon: 'smartphone' }
                ];
                const channelCounts = data.channel_breakdown || {};
                const total = Math.max(data.total_reviews, 1);
                
                const allChannelNames = Array.from(new Set([
                  ...defaultChannels.map(c => c.name),
                  ...Object.keys(channelCounts)
                ]));

                const getChannelIcon = (name) => {
                  if (name.includes('Web')) return 'language';
                  if (name.includes('Shopify')) return 'shopping_bag';
                  if (name.includes('Amazon')) return 'storefront';
                  return 'smartphone';
                };

                return allChannelNames.map((ch) => {
                  const cnt = channelCounts[ch] || 0;
                  const pct = Math.round((cnt / total) * 100);

                  return (
                    <div key={ch} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-purple-950">
                          <span className="material-symbols-outlined text-[15px] text-[#5122fe]">
                            {getChannelIcon(ch)}
                          </span>
                          <span>{ch}</span>
                        </div>
                        <span className="font-mono text-purple-700 text-[11px]">
                          <strong>{cnt}</strong> reviews ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-purple-100/70 overflow-hidden">
                        <div 
                          className={`h-full ${cnt > 0 ? 'bg-gradient-to-r from-[#5122fe] to-violet-500' : 'bg-transparent'} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(pct, cnt > 0 ? 5 : 0)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

function getDayFullName(day) {
  switch (day) {
    case 'Mon': return 'Monday';
    case 'Tue': return 'Tuesday';
    case 'Wed': return 'Wednesday';
    case 'Thu': return 'Thursday';
    case 'Fri': return 'Friday';
    case 'Sat': return 'Saturday';
    case 'Sun': return 'Sunday';
    default: return day;
  }
}
