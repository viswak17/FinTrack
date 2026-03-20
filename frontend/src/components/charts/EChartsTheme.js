/**
 * ECharts FinTrack dark theme.
 * Register once in main.jsx — applied to all ECharts instances via theme="fintrac"
 */
import * as echarts from 'echarts';

const fintracTheme = {
  backgroundColor: 'transparent',
  color: ['#6366F1', '#10B981', '#F59E0B', '#38BDF8', '#EF4444', '#818CF8', '#A78BFA', '#F472B6'],
  textStyle: {
    fontFamily: 'DM Sans, sans-serif',
    color: '#94A3B8',
  },
  title: {
    textStyle: {
      color: '#F1F5F9',
      fontFamily: 'Syne, sans-serif',
      fontWeight: 700,
    },
    subtextStyle: {
      color: '#94A3B8',
    },
  },
  grid: {
    borderColor: '#1E1E35',
    left: '12px',
    right: '12px',
    containLabel: true,
  },
  line: {
    smooth: false,
    symbol: 'circle',
    symbolSize: 6,
  },
  radar: {
    name: { textStyle: { color: '#94A3B8' } },
    splitLine: { lineStyle: { color: '#1E1E35' } },
    splitArea: { areaStyle: { color: ['rgba(30,30,53,0.3)', 'transparent'] } },
    axisLine: { lineStyle: { color: '#1E1E35' } },
  },
  bar: {
    barBorderRadius: [4, 4, 0, 0],
    itemStyle: { borderRadius: [4, 4, 0, 0] },
  },
  pie: {
    itemStyle: { borderWidth: 2, borderColor: '#080810' },
  },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#475569', fontFamily: 'DM Sans' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#475569', fontFamily: 'DM Sans', fontSize: 12 },
    splitLine: { lineStyle: { color: '#1E1E35', type: 'dashed' } },
  },
  logAxis: {
    axisLabel: { color: '#475569' },
    splitLine: { lineStyle: { color: '#1E1E35', type: 'dashed' } },
  },
  legend: {
    textStyle: { color: '#94A3B8', fontFamily: 'DM Sans', fontSize: 12 },
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
  },
  tooltip: {
    backgroundColor: '#161627',
    borderColor: '#1E1E35',
    borderWidth: 1,
    borderRadius: 12,
    padding: [10, 14],
    textStyle: {
      color: '#F1F5F9',
      fontFamily: 'DM Sans',
      fontSize: 13,
    },
    axisPointer: {
      lineStyle: { color: '#1E1E35' },
      crossStyle: { color: '#1E1E35' },
    },
  },
  timeline: {
    lineStyle: { color: '#1E1E35' },
    itemStyle: { color: '#6366F1' },
    label: { color: '#94A3B8' },
    controlStyle: {
      color: '#6366F1',
      borderColor: '#6366F1',
    },
  },
};

echarts.registerTheme('fintrac', fintracTheme);

export default fintracTheme;
