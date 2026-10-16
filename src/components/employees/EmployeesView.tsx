import React, { useState } from 'react';
import { PinService } from '../../services/pinService.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { Employee, EmployeeRole } from '../../types/pos.ts';
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
  AlertCircle
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

  const handleOpenAdd = () => {
    requireOwnerAuth(() => {
      setEditingEmp(null);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormRole('cashier');
      setFormPin(''); // owner chooses the PIN (field is masked, so a random one would be unknowable)
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
      setFormPin(''); // existing PIN is hashed; blank = keep current
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

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Staff & Roles Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control 4-digit PIN authentication, roles (Owner, Manager, Cashier), and granular access rules
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>

        {/* Employees Table */}
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
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
