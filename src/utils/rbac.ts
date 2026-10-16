/**
 * AuraPOS Phase 9 — Role-Based Access Control & Permissions Engine
 * Provides:
 * - Granular permission checking with wildcard ('*') support
 * - Predefined role templates for retail / hospitality workflows
 * - Employee audit trail logging
 */

import { Employee } from '../types/pos.ts';
import {
  GranularPermission,
  RoleTemplate,
  EmployeeAuditAction,
  EmployeeAuditLog
} from '../types/advancedFeatures.ts';
import { StorageService } from '../services/storageService.ts';

export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  owner: {
    role: 'owner',
    name: 'Business Owner',
    description: 'Full unconstrained administrative access across all stores and settings.',
    defaultPermissions: ['*']
  },
  general_manager: {
    role: 'general_manager',
    name: 'General Manager',
    description: 'Multi-store oversight, financial reporting, employee management, and catalog controls.',
    defaultPermissions: [
      'pos:checkout',
      'pos:apply_discount',
      'pos:issue_refund',
      'pos:price_override',
      'pos:reprint_receipt',
      'inventory:view',
      'inventory:adjust',
      'inventory:counts',
      'inventory:purchase_orders',
      'inventory:transfers',
      'reports:daily_sales',
      'reports:financial_summary',
      'reports:export_csv',
      'reports:z_report',
      'settings:store_profile',
      'settings:printers',
      'staff:view',
      'staff:manage_pins',
      'staff:audit_logs'
    ]
  },
  inventory_manager: {
    role: 'inventory_manager',
    name: 'Inventory Controller',
    description: 'Procurement, stock count reconciliation, supplier management, and inter-branch transfers.',
    defaultPermissions: [
      'inventory:view',
      'inventory:adjust',
      'inventory:counts',
      'inventory:purchase_orders',
      'inventory:transfers',
      'reports:daily_sales',
      'reports:export_csv'
    ]
  },
  supervisor: {
    role: 'supervisor',
    name: 'Shift Supervisor',
    description: 'POS cashiering with authority to authorize discounts, refunds, and price overrides.',
    defaultPermissions: [
      'pos:checkout',
      'pos:apply_discount',
      'pos:issue_refund',
      'pos:price_override',
      'pos:reprint_receipt',
      'inventory:view',
      'reports:daily_sales',
      'reports:z_report'
    ]
  },
  cashier: {
    role: 'cashier',
    name: 'Front-Desk Cashier',
    description: 'Standard checkout operations, item scanning, and receipt printing without override privileges.',
    defaultPermissions: [
      'pos:checkout',
      'pos:reprint_receipt',
      'inventory:view'
    ]
  }
};

export class RbacService {
  /**
   * Check whether an employee has a specific permission
   */
  static hasPermission(
    employee: Employee | null | undefined,
    requiredPermission: GranularPermission
  ): boolean {
    if (!employee || !employee.active) return false;

    // Owners always have all permissions
    if (employee.role === 'owner') return true;

    // Check wildcard in explicit permissions
    if (employee.permissions && employee.permissions.includes('*')) return true;

    // Check direct assignment
    if (employee.permissions && employee.permissions.includes(requiredPermission)) {
      return true;
    }

    // Check fallback permissions from role template
    const template = ROLE_TEMPLATES[employee.role];
    if (template) {
      if (template.defaultPermissions.includes('*')) return true;
      if (template.defaultPermissions.includes(requiredPermission)) return true;
    }

    return false;
  }

  /**
   * Record an employee security or action audit log
   */
  static logAudit(params: {
    employeeId: string;
    employeeName: string;
    performedById: string;
    performedByName: string;
    action: EmployeeAuditAction;
    details: string;
  }): EmployeeAuditLog {
    const entry: EmployeeAuditLog = {
      id: `emp_aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      performedById: params.performedById,
      performedByName: params.performedByName,
      action: params.action,
      details: params.details,
      timestamp: new Date().toISOString()
    };

    const logs = StorageService.getEmployeeAuditLogs();
    logs.unshift(entry);
    StorageService.saveEmployeeAuditLogs(logs);

    return entry;
  }
}
