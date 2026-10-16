import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Currency } from '../../utils/currency.ts';
import { ReportingService } from '../../services/reportingService.ts';
import { BackOfficeService } from '../../services/backOfficeService.ts';
import { ReportFilterOptions, ComprehensiveFinancialReport } from '../../types/reporting.ts';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  DollarSign,
  Download,
  Calendar,
  Layers,
  Award,
  Users,
  Database,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Printer,
  ChevronDown,
  Filter,
  FileText,
  X,
  PieChart
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { sales, products, categories, employees, showToast, isOffline, pendingSyncCount, currentStoreId, settings } = usePOS();
  const isLocalDataOnly = isOffline || pendingSyncCount > 0;

  // Filter States
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom' | 'all'>('7days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Terminals & Shifts
  const [terminals, setTerminals] = useState<any[]>([]);
  const [cashShifts, setCashShifts] = useState<any[]>([]);
  const [showZReportModal, setShowZReportModal] = useState<boolean>(false);

  useEffect(() => {
    async function loadBackOfficeData() {
      try {
        const terms = await BackOfficeService.getTerminals(currentStoreId);
        setTerminals(terms);
        const shifts = await BackOfficeService.getCashShifts(currentStoreId);
        setCashShifts(shifts);
      } catch (err) {
        console.warn('Could not load terminals or shifts:', err);
      }
    }
    loadBackOfficeData();
  }, [currentStoreId]);

  // Build Filter Options
  const filterOptions: ReportFilterOptions = useMemo(
    () => ({
      dateRange,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      terminalId: selectedTerminalId !== 'all' ? selectedTerminalId : undefined,
      employeeId: selectedEmployeeId !== 'all' ? selectedEmployeeId : undefined,
      categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined
    }),
    [dateRange, startDate, endDate, selectedTerminalId, selectedEmployeeId, selectedCategoryId]
  );

  // Generate Report
  const report: ComprehensiveFinancialReport = useMemo(() => {
    return ReportingService.generateFinancialReport(
      sales,
      products,
      categories,
      employees,
      cashShifts,
      filterOptions
    );
  }, [sales, products, categories, employees, cashShifts, filterOptions]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const csvContent = ReportingService.generateFinancialCsv(report);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AuraPOS_Financial_Report_${dateRange}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'Financial Report Exported (CSV)' });
  };

  const zReportText = useMemo(() => {
    return ReportingService.formatEndOfDayZReport(report, settings?.name || 'AuraPOS Store');
  }, [report, settings]);

  const maxCatRevenue = Math.max(...report.categoryBreakdown.map(c => c.revenue), 1);
  const maxDayRevenue = Math.max(...report.dailyTrends.map(d => d.grossSales), 1);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Export Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Business Analytics & Financial Reports
              </h1>
              {isLocalDataOnly && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Local Data
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Multi-dimensional sales audit, product margins, payment tenders, and cash discrepancy reconciliations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowZReportModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Print Z-Report</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              <span>Report Filters</span>
            </div>
            <button
              onClick={() => {
                setDateRange('7days');
                setStartDate('');
                setEndDate('');
                setSelectedTerminalId('all');
                setSelectedEmployeeId('all');
                setSelectedCategoryId('all');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom' },
              { id: 'all', label: 'All Time' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setDateRange(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  dateRange === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dropdown Filters: Terminal, Employee, Category, and Custom Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Terminal Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Terminal Register
              </label>
              <select
                value={selectedTerminalId}
                onChange={e => setSelectedTerminalId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Terminals</option>
                {terminals.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cashier / Employee Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cashier / Staff
              </label>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={e => setSelectedCategoryId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Inputs */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Sales</span>
            <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1">${report.grossSales.toFixed(2)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Net Sales</span>
            <p className="text-lg font-black text-emerald-600 font-mono mt-1">${report.netSales.toFixed(2)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Discounts</span>
            <p className="text-lg font-black text-amber-600 font-mono mt-1">-${report.totalDiscounts.toFixed(2)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Taxes</span>
            <p className="text-lg font-black text-blue-600 font-mono mt-1">${report.totalTaxes.toFixed(2)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cost (COGS)</span>
            <p className="text-lg font-black text-slate-700 dark:text-slate-300 font-mono mt-1">${report.totalCostOfGoodsSold.toFixed(2)}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Gross Profit</span>
            <p className="text-lg font-black text-emerald-600 font-mono mt-1">${report.totalGrossProfit.toFixed(2)}</p>
            <span className="text-[10px] text-emerald-500 font-bold">{report.grossProfitMarginPct}% margin</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Orders</span>
            <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1">{report.totalOrders}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Avg Basket</span>
            <p className="text-lg font-black text-indigo-600 font-mono mt-1">${report.averageBasket.toFixed(2)}</p>
          </div>
        </div>

        {/* Daily Sales Trend Chart Card */}
        {report.dailyTrends.length > 0 && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Daily Sales Trend</span>
              </h3>
              <span className="text-xs text-slate-500">{report.dailyTrends.length} Days Recorded</span>
            </div>

            <div className="space-y-2 pt-2">
              {report.dailyTrends.map(day => {
                const pct = Math.round((day.grossSales / maxDayRevenue) * 100);
                return (
                  <div key={day.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 font-semibold text-slate-600 dark:text-slate-400">{day.formattedDate}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-5 rounded-lg overflow-hidden flex">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-lg transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                    <div className="w-28 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${day.grossSales.toFixed(2)}
                    </div>
                    <span className="w-16 text-right text-slate-500 text-[11px]">{day.ordersCount} tkts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Column Section: Category Breakdown & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Sales Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Revenue by Category</span>
            </h3>

            <div className="space-y-3">
              {report.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No category sales recorded in this period.</p>
              ) : (
                report.categoryBreakdown.map(cat => {
                  const barWidth = Math.round((cat.revenue / maxCatRevenue) * 100);
                  return (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ${cat.revenue.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500">({cat.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.max(4, barWidth)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Payment Tender Distribution</span>
            </h3>

            <div className="space-y-3">
              {report.paymentBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No payments recorded in this period.</p>
              ) : (
                report.paymentBreakdown.map(p => (
                  <div key={p.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.method}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ${p.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500">({p.percentageShare}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.max(4, p.percentageShare)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Product Performance Table: Top Products & Margins */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Product Sales & Margin Analysis</span>
            </h3>
            <span className="text-xs text-slate-500">{report.topProducts.length} Items Listed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 font-bold">Product Name</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold text-right">Units Sold</th>
                  <th className="px-4 py-3 font-bold text-right">Revenue</th>
                  <th className="px-4 py-3 font-bold text-right">Cost (COGS)</th>
                  <th className="px-4 py-3 font-bold text-right">Gross Profit</th>
                  <th className="px-4 py-3 font-bold text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.topProducts.map(prod => (
                  <tr key={prod.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {prod.name}
                      <span className="block text-[10px] text-slate-400 font-mono">{prod.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{prod.categoryName}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{prod.unitsSold}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">${prod.grossSales.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">${prod.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      ${prod.grossProfit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {prod.profitMarginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cash Shift Discrepancy Audits */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Cash Drawer Discrepancy Audits</span>
            </h3>
            <span className="text-xs text-slate-500">{report.cashDiscrepancies.length} Shifts Audited</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 font-bold">Terminal</th>
                  <th className="px-4 py-3 font-bold">Cashier</th>
                  <th className="px-4 py-3 font-bold">Shift Start</th>
                  <th className="px-4 py-3 font-bold text-right">Opening Float</th>
                  <th className="px-4 py-3 font-bold text-right">Expected Cash</th>
                  <th className="px-4 py-3 font-bold text-right">Actual Count</th>
                  <th className="px-4 py-3 font-bold text-right">Discrepancy</th>
                  <th className="px-4 py-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.cashDiscrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                      No shift records available for discrepancy audit.
                    </td>
                  </tr>
                ) : (
                  report.cashDiscrepancies.map(cd => (
                    <tr key={cd.shiftId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{cd.terminalName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{cd.employeeName}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(cd.openedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">${cd.openingFloat.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono">${cd.expectedCash.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">${cd.actualCash.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span
                          className={
                            cd.discrepancy > 0
                              ? 'text-emerald-600'
                              : cd.discrepancy < 0
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }
                        >
                          {cd.discrepancy > 0 ? '+' : ''}
                          ${cd.discrepancy.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cd.status === 'balanced'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : cd.status === 'over'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {cd.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Printable Z-Report Modal */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">End-of-Day Financial Z-Report</h3>
              </div>
              <button
                onClick={() => setShowZReportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs bg-slate-950 text-emerald-400 p-4 rounded-xl m-4 whitespace-pre select-text">
              {zReportText}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(zReportText);
                  showToast({ type: 'info', title: 'Z-Report Copied to Clipboard' });
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                Copy Text
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
