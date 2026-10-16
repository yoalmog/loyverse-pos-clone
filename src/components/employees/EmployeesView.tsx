import React, { useState, useMemo, useEffect } from 'react';
import { PinService } from '../../services/pinService.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { Employee, EmployeeRole, Timecard } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  UserCheck,
  Plus,
  Shield,
  KeyRound,
  CheckCircle2,
  Lock,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Clock,
  Calendar,
  Download,
  Filter,
  Users,
  BarChart3,
  Check,
  Play,
  Square
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'pos', name: 'Point of Sale (Register)' },
  { id: 'sales', name: 'View Sales History' },
  { id: 'refunds', name: 'Authorize Refunds / Returns' },
  { id: 'products', name: 'Manage Products & Prices' },
  { id: 'inventory', name: 'Adjust Stock & Inventory' },
  { id: 'customers', name: 'Manage Customers & Loyalty' },
  { id: 'reports', name: 'Access Financial Reports' },
  { id: 'discounts', name: 'Configure Promotions & Discounts' },
  { id: 'settings', name: 'Store & Hardware Settings' },
  { id: 'employees', name: 'Manage Staff & Roles' }
];

export const EmployeesView: React.FC = () => {
  const { employees, currentEmployee, refreshData, showToast, settings, isOwner, requireOwnerAuth, t } = usePOS();

  // Navigation tab (Loyverse Manual Chapter 5.4 - 5.6)
  const [activeTab, setActiveTab] = useState<'employees' | 'timecards' | 'total_hours'>('employees');

  // Employee modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formRole, setFormRole] = useState<EmployeeRole>('cashier');
  const [formPin, setFormPin] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formPermissions, setFormPermissions] = useState<string[]>(['pos', 'sales', 'customers']);

  // Timecard states
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [timecardEmployeeFilter, setTimecardEmployeeFilter] = useState<string>('all');
  const [timecardDateFilter, setTimecardDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('7days');
  const [isTimecardModalOpen, setIsTimecardModalOpen] = useState<boolean>(false);
  const [editingTimecard, setEditingTimecard] = useState<Timecard | null>(null);

  // Timecard form
  const [tcEmployeeId, setTcEmployeeId] = useState<string>('');
  const [tcClockInDate, setTcClockInDate] = useState<string>('');
  const [tcClockInTime, setTcClockInTime] = useState<string>('');
  const [tcClockOutDate, setTcClockOutDate] = useState<string>('');
  const [tcClockOutTime, setTcClockOutTime] = useState<string>('');
  const [tcNotes, setTcNotes] = useState<string>('');
  const [tcIsOpenShift, setTcIsOpenShift] = useState<boolean>(false);

  // Load timecards on mount & refresh
  const loadTimecards = () => {
    const list = StorageService.getTimecards();
    setTimecards(list);
  };

  useEffect(() => {
    loadTimecards();
  }, []);

  const handleOpenAdd = () => {
    requireOwnerAuth(() => {
      setEditingEmp(null);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormRole('cashier');
      setFormPin('');
      setFormActive(true);
      setFormPermissions(['pos', 'sales', 'customers']);
      setIsModalOpen(true);
    }, t('employees.addOwnerAuth', 'Add New Staff Member'));
  };

  const handleOpenEdit = (emp: Employee) => {
    requireOwnerAuth(() => {
      setEditingEmp(emp);
      setFormName(emp.name);
      setFormEmail(emp.email);
      setFormPhone(emp.phone);
      setFormRole(emp.role);
      setFormPin('');
      setFormActive(emp.active);
      setFormPermissions(emp.permissions);
      setIsModalOpen(true);
    }, t('employees.editOwnerAuth', 'Edit Staff Role & Permissions'));
  };

  const handleTogglePermission = (permId: string) => {
    setFormPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const pinProvided = formPin.trim() !== '';
    if (!formName.trim() || (!editingEmp && !pinProvided) || (pinProvided && !PinService.isValidFormat(formPin.trim()))) {
      showToast({ type: 'warning', title: 'PIN must be exactly 4 digits' });
      return;
    }

    requireOwnerAuth(async () => {
      const all = StorageService.getEmployees();
      const newPinHash = pinProvided ? await PinService.hash(formPin.trim()) : null;
      const nowIso = new Date().toISOString();

      if (editingEmp) {
        const idx = all.findIndex(e => e.id === editingEmp.id);
        if (idx !== -1) {
          all[idx] = {
            ...editingEmp,
            name: formName.trim(),
            email: formEmail.trim(),
            phone: formPhone.trim(),
            role: formRole,
            pin: newPinHash ?? editingEmp.pin,
            active: formActive,
            permissions: formPermissions
          };
          StorageService.saveEmployees(all);
          refreshData();
          showToast({ type: 'success', title: 'Employee Updated', message: formName });
        }
      } else {
        const newEmp: Employee = {
          id: `emp_${Date.now()}`,
          storeId: settings.id,
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          role: formRole,
          pin: newPinHash as string,
          active: formActive,
          permissions: formPermissions,
          lastLogin: nowIso
        };
        all.push(newEmp);
        StorageService.saveEmployees(all);
        refreshData();
        showToast({ type: 'success', title: 'Employee Created', message: formName });
      }

      setIsModalOpen(false);
    }, 'Save Staff Member');
  };

  // Timecard handlers
  const handleOpenAddTimecard = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    setEditingTimecard(null);
    setTcEmployeeId(employees[0]?.id || '');
    setTcClockInDate(todayStr);
    setTcClockInTime('09:00');
    setTcClockOutDate(todayStr);
    setTcClockOutTime(timeStr);
    setTcNotes('');
    setTcIsOpenShift(false);
    setIsTimecardModalOpen(true);
  };

  const handleOpenEditTimecard = (tc: Timecard) => {
    setEditingTimecard(tc);
    setTcEmployeeId(tc.employeeId);

    const inDate = new Date(tc.clockIn);
    setTcClockInDate(tc.clockIn.split('T')[0]);
    setTcClockInTime(inDate.toTimeString().slice(0, 5));

    if (tc.clockOut) {
      const outDate = new Date(tc.clockOut);
      setTcClockOutDate(tc.clockOut.split('T')[0]);
      setTcClockOutTime(outDate.toTimeString().slice(0, 5));
      setTcIsOpenShift(false);
    } else {
      setTcClockOutDate('');
      setTcClockOutTime('');
      setTcIsOpenShift(true);
    }

    setTcNotes(tc.notes || '');
    setIsTimecardModalOpen(true);
  };

  const handleDeleteTimecard = (id: string) => {
    if (!window.confirm('Delete this timecard record?')) return;
    const filtered = timecards.filter(c => c.id !== id);
    StorageService.saveTimecards(filtered);
    setTimecards(filtered);
    showToast({ type: 'info', title: 'Timecard deleted' });
  };

  const handleSaveTimecard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tcEmployeeId || !tcClockInDate || !tcClockInTime) {
      showToast({ type: 'warning', title: 'Clock-in date and time required' });
      return;
    }

    const emp = employees.find(e => e.id === tcEmployeeId);
    const empName = emp ? emp.name : 'Unknown Staff';
    const clockInIso = new Date(`${tcClockInDate}T${tcClockInTime}:00`).toISOString();

    let clockOutIso: string | null = null;
    let totalMinutes = 0;

    if (!tcIsOpenShift && tcClockOutDate && tcClockOutTime) {
      clockOutIso = new Date(`${tcClockOutDate}T${tcClockOutTime}:00`).toISOString();
      const diffMs = new Date(clockOutIso).getTime() - new Date(clockInIso).getTime();
      if (diffMs < 0) {
        showToast({ type: 'warning', title: 'Clock-out cannot precede clock-in' });
        return;
      }
      totalMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    const nowIso = new Date().toISOString();
    let updated: Timecard[];

    if (editingTimecard) {
      updated = timecards.map(c => {
        if (c.id === editingTimecard.id) {
          return {
            ...c,
            employeeId: tcEmployeeId,
            employeeName: empName,
            clockIn: clockInIso,
            clockOut: clockOutIso,
            totalMinutes: clockOutIso ? totalMinutes : undefined,
            notes: tcNotes.trim() || undefined,
            updatedAt: nowIso
          };
        }
        return c;
      });
      showToast({ type: 'success', title: 'Timecard updated' });
    } else {
      const newCard: Timecard = {
        id: `tc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeId: settings.id || 'store_aura_main',
        employeeId: tcEmployeeId,
        employeeName: empName,
        clockIn: clockInIso,
        clockOut: clockOutIso,
        totalMinutes: clockOutIso ? totalMinutes : undefined,
        notes: tcNotes.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      updated = [newCard, ...timecards];
      showToast({ type: 'success', title: 'Timecard created' });
    }

    StorageService.saveTimecards(updated);
    setTimecards(updated);
    setIsTimecardModalOpen(false);
  };

  // Filtered Timecards
  const filteredTimecards = useMemo(() => {
    let list = [...timecards];

    if (timecardEmployeeFilter !== 'all') {
      list = list.filter(tc => tc.employeeId === timecardEmployeeFilter);
    }

    if (timecardDateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (timecardDateFilter === 'today') {
        list = list.filter(tc => new Date(tc.clockIn).getTime() >= startOfDay);
      } else if (timecardDateFilter === '7days') {
        const sevenDaysAgo = startOfDay - 7 * 86400000;
        list = list.filter(tc => new Date(tc.clockIn).getTime() >= sevenDaysAgo);
      } else if (timecardDateFilter === '30days') {
        const thirtyDaysAgo = startOfDay - 30 * 86400000;
        list = list.filter(tc => new Date(tc.clockIn).getTime() >= thirtyDaysAgo);
      }
    }

    return list.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
  }, [timecards, timecardEmployeeFilter, timecardDateFilter]);

  // Aggregated hours worked per employee
  const employeeHoursSummary = useMemo(() => {
    const summary: Record<string, { employee: Employee; totalMinutes: number; shiftCount: number }> = {};

    employees.forEach(emp => {
      summary[emp.id] = { employee: emp, totalMinutes: 0, shiftCount: 0 };
    });

    filteredTimecards.forEach(tc => {
      if (summary[tc.employeeId]) {
        summary[tc.employeeId].shiftCount += 1;
        if (tc.totalMinutes) {
          summary[tc.employeeId].totalMinutes += tc.totalMinutes;
        }
      }
    });

    return Object.values(summary);
  }, [employees, filteredTimecards]);

  const formatDuration = (mins?: number) => {
    if (mins === undefined || mins === null) return 'In progress';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const handleExportTimecardsCsv = () => {
    if (filteredTimecards.length === 0) {
      showToast({ type: 'warning', title: 'No timecards to export' });
      return;
    }
    const headers = ['Timecard ID', 'Employee Name', 'Clock In', 'Clock Out', 'Total Minutes', 'Total Hours', 'Notes'];
    const rows = filteredTimecards.map(tc => [
      tc.id,
      `"${tc.employeeName.replace(/"/g, '""')}"`,
      new Date(tc.clockIn).toLocaleString(),
      tc.clockOut ? new Date(tc.clockOut).toLocaleString() : 'Working',
      tc.totalMinutes || 0,
      tc.totalMinutes ? (tc.totalMinutes / 60).toFixed(2) : '0',
      `"${(tc.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `loyverse_timecards_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ type: 'success', title: 'Exported Timecards CSV' });
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header with Loyverse Back Office Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Employees & Timecards</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage staff permissions, shift timecards, clock in/out tracking, and total hours worked (Loyverse Manual Chapter 5)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'employees' && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            )}

            {activeTab === 'timecards' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportTimecardsCsv}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleOpenAddTimecard}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Time Card</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employees List</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">{employees.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('timecards')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'timecards'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Time Cards</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">{filteredTimecards.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('total_hours')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'total_hours'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Total Hours Worked</span>
          </button>
        </div>

        {/* TAB 1: EMPLOYEES LIST */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center">Cashier PIN</th>
                    <th className="py-3.5 px-4">Permissions</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Activity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                            {emp.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{emp.name}</p>
                            <p className="text-[11px] text-slate-400">{emp.email || emp.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`capitalize font-bold text-xs px-2.5 py-1 rounded-lg ${
                            emp.role === 'owner'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : emp.role === 'manager'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          ••••
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] text-slate-600">
                          {emp.permissions.length} module(s) granted
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            emp.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {emp.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Staff Member"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TIMECARDS (Loyverse Manual 5.4 - 5.5, p. 140-144) */}
        {activeTab === 'timecards' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Employee:</span>
                </div>
                <select
                  value={timecardEmployeeFilter}
                  onChange={e => setTimecardEmployeeFilter(e.target.value)}
                  className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 ml-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Period:</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {(['today', '7days', '30days', 'all'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setTimecardDateFilter(period)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                        timecardDateFilter === period
                          ? 'bg-white text-blue-600 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {period === '7days' ? 'Last 7 Days' : period === '30days' ? 'Last 30 Days' : period}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Showing <strong>{filteredTimecards.length}</strong> shift entries
              </div>
            </div>

            {/* Timecards Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Clock In</th>
                      <th className="py-3.5 px-4">Clock Out</th>
                      <th className="py-3.5 px-4 text-center">Total Working Time</th>
                      <th className="py-3.5 px-4">Notes</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTimecards.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                          <p className="font-semibold">No timecards found for this period</p>
                          <p className="text-[11px] mt-0.5">Click "Add Time Card" above to log working hours manually.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTimecards.map(tc => {
                        const inDate = new Date(tc.clockIn);
                        const outDate = tc.clockOut ? new Date(tc.clockOut) : null;
                        const isActive = !tc.clockOut;

                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 text-sm">{tc.employeeName}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-slate-700">
                                {inDate.toLocaleDateString()} {inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-200 text-[11px]">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Currently Working
                                </span>
                              ) : (
                                <span className="font-mono text-slate-700">
                                  {outDate?.toLocaleDateString()} {outDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${
                                isActive ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {formatDuration(tc.totalMinutes)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">
                              {tc.notes || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditTimecard(tc)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Timecard"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTimecard(tc.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Timecard"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TOTAL HOURS WORKED REPORT (Loyverse Manual 5.6, p. 145-147) */}
        {activeTab === 'total_hours' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">Filter Period:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {(['today', '7days', '30days', 'all'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setTimecardDateFilter(period)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                        timecardDateFilter === period
                          ? 'bg-white text-blue-600 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {period === '7days' ? 'Last 7 Days' : period === '30days' ? 'Last 30 Days' : period}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center">Recorded Shifts</th>
                    <th className="py-3.5 px-4 text-center">Regular Hours</th>
                    <th className="py-3.5 px-4 text-center">Overtime Hours (&gt;40h)</th>
                    <th className="py-3.5 px-4 text-right">Total Hours Worked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeHoursSummary.map(row => {
                    const totalHours = (row.totalMinutes / 60);
                    const regularHours = Math.min(40, totalHours);
                    const overtimeHours = Math.max(0, totalHours - 40);

                    return (
                      <tr key={row.employee.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 text-sm leading-tight">{row.employee.name}</p>
                          <p className="text-[11px] text-slate-400">{row.employee.email || row.employee.phone}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="capitalize font-semibold text-xs text-slate-700">
                            {row.employee.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {row.shiftCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                          {regularHours.toFixed(2)} hrs
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-amber-700">
                          {overtimeHours > 0 ? `+${overtimeHours.toFixed(2)} hrs` : '0.00 hrs'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-black text-sm text-blue-700">
                            {totalHours.toFixed(2)} hrs ({formatDuration(row.totalMinutes)})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmp ? 'Edit Staff Member' : 'New Staff Member'}
                </h3>
                <p className="text-xs text-slate-500">Configure role and 4-digit PIN authentication</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as EmployeeRole)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">4-Digit PIN {editingEmp ? '' : '*'}</label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    required={!editingEmp}
                    value={formPin}
                    onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={editingEmp ? 'Blank = keep current' : '4 digits'}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Module Permissions Checkboxes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  System Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {ALL_PERMISSIONS.map(perm => {
                    const isChecked = formPermissions.includes(perm.id);
                    return (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300"
                        />
                        <span className="text-slate-700 font-medium">{perm.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emp_active"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="emp_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (Allowed to sign in)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Timecard Modal (Loyverse Manual 5.4 - 5.5, p. 142) */}
      {isTimecardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingTimecard ? 'Edit Time Card' : 'Add Time Card'}
                </h3>
                <p className="text-xs text-slate-500">Log employee work shift hours</p>
              </div>
              <button
                onClick={() => setIsTimecardModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTimecard} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  value={tcEmployeeId}
                  onChange={e => setTcEmployeeId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clock In *</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={tcClockInDate}
                    onChange={e => setTcClockInDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-300"
                  />
                  <input
                    type="time"
                    required
                    value={tcClockInTime}
                    onChange={e => setTcClockInTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Clock Out</label>
                  <label className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tcIsOpenShift}
                      onChange={e => setTcIsOpenShift(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span>Still working (Open shift)</span>
                  </label>
                </div>

                {!tcIsOpenShift && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      required={!tcIsOpenShift}
                      value={tcClockOutDate}
                      onChange={e => setTcClockOutDate(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300"
                    />
                    <input
                      type="time"
                      required={!tcIsOpenShift}
                      value={tcClockOutTime}
                      onChange={e => setTcClockOutTime(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-300"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Reason</label>
                <textarea
                  rows={2}
                  value={tcNotes}
                  onChange={e => setTcNotes(e.target.value)}
                  placeholder="e.g. Regular shift, weekend coverage, overtime"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTimecardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Time Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
