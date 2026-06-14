// ═══════════════════════════════════════════════════════════════
// RBAC Permission Definitions
// ═══════════════════════════════════════════════════════════════
// Permissions are string keys checked by requirePermission() middleware.
// Each Role document stores an array of these strings.
// To add a new permission: define it here, add to the relevant roles, done.

const PERMISSIONS = {
  // ── Leads ──────────────────────────────────────────────────────
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  LEADS_ASSIGN: 'leads.assign',
  LEADS_UPLOAD: 'leads.upload',
  LEADS_EXPORT: 'leads.export',
  LEADS_CHECK_DUPLICITY: 'leads.check-duplicity',

  // ── Users ──────────────────────────────────────────────────────
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  // ── Goals ──────────────────────────────────────────────────────
  GOALS_VIEW: 'goals.view',
  GOALS_CREATE: 'goals.create',
  GOALS_UPDATE: 'goals.update',
  GOALS_DELETE: 'goals.delete',

  // ── Tasks ──────────────────────────────────────────────────────
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',

  // ── Tickets ────────────────────────────────────────────────────
  TICKETS_VIEW: 'tickets.view',
  TICKETS_CREATE: 'tickets.create',
  TICKETS_UPDATE: 'tickets.update',
  TICKETS_DELETE: 'tickets.delete',

  // ── Analytics ──────────────────────────────────────────────────
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_LEADERBOARD: 'analytics.leaderboard',

  // ── Dashboard ──────────────────────────────────────────────────
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_DAILY_REPORT: 'dashboard.daily-report',
  DASHBOARD_USER_PERFORMANCE: 'dashboard.user-performance',
  DASHBOARD_DAY_DETAIL: 'dashboard.day-detail',
  DASHBOARD_DAY_COMPARE: 'dashboard.day-compare',
  DASHBOARD_WEEK_COMPARE: 'dashboard.week-compare',

  // ── Extension ──────────────────────────────────────────────────
  EXTENSION_VIEW: 'extension.view',
  EXTENSION_ADMIN: 'extension.admin',

  // ── Nepalcan ───────────────────────────────────────────────────
  NEPALCAN_VIEW: 'nepalcan.view',
  NEPALCAN_MANAGE: 'nepalcan.manage',

  // ── Pipeline ───────────────────────────────────────────────────
  PIPELINE_VIEW: 'pipeline.view',
  PIPELINE_MANAGE: 'pipeline.manage',

  // ── Vendors ────────────────────────────────────────────────────
  VENDORS_VIEW: 'vendors.view',
  VENDORS_MANAGE: 'vendors.manage',
  VENDORS_SNAPSHOTS: 'vendors.snapshots',
  LISTING_SNAPSHOTS: 'listing.snapshots',

  // ── Delivery Zones ─────────────────────────────────────────────
  DELIVERY_ZONES_VIEW: 'delivery-zones.view',
  DELIVERY_ZONES_MANAGE: 'delivery-zones.manage',

  // ── Departments ────────────────────────────────────────────────
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_CREATE: 'departments.create',
  DEPARTMENTS_UPDATE: 'departments.update',
  DEPARTMENTS_DELETE: 'departments.delete',

  // ── Sync ───────────────────────────────────────────────────────
  SYNC_MANAGE: 'sync.manage',

  // ── BD Tiers ───────────────────────────────────────────────────
  BD_TIERS_VIEW: 'bd-tiers.view',

  // ── Notifications ──────────────────────────────────────────────
  NOTIFICATIONS_VIEW: 'notifications.view',

  // ── Reports ────────────────────────────────────────────────────
  REPORTS_MANAGE: 'reports.manage',

  // ── Activities ─────────────────────────────────────────────────
  ACTIVITIES_VIEW: 'activities.view',
  ACTIVITIES_CREATE: 'activities.create',

  // ── Finance ───────────────────────────────────────────────────
  FINANCE_VIEW: 'finance.view',
  FINANCE_CREATE: 'finance.create',
  FINANCE_UPDATE: 'finance.update',
  FINANCE_DELETE: 'finance.delete',
};

// Default permissions for each role
const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS), // ALL permissions

  admin: [
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_UPDATE,
    PERMISSIONS.LEADS_DELETE,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.LEADS_UPLOAD,
    PERMISSIONS.LEADS_EXPORT,
    PERMISSIONS.LEADS_CHECK_DUPLICITY,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.GOALS_VIEW,
    PERMISSIONS.GOALS_CREATE,
    PERMISSIONS.GOALS_UPDATE,
    PERMISSIONS.GOALS_DELETE,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.TASKS_DELETE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_UPDATE,
    PERMISSIONS.TICKETS_DELETE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_LEADERBOARD,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_DAILY_REPORT,
    PERMISSIONS.DASHBOARD_USER_PERFORMANCE,
    PERMISSIONS.DASHBOARD_DAY_DETAIL,
    PERMISSIONS.DASHBOARD_DAY_COMPARE,
    PERMISSIONS.DASHBOARD_WEEK_COMPARE,
    PERMISSIONS.EXTENSION_VIEW,
    PERMISSIONS.EXTENSION_ADMIN,
    PERMISSIONS.NEPALCAN_VIEW,
    PERMISSIONS.NEPALCAN_MANAGE,
    PERMISSIONS.VENDORS_VIEW,
    PERMISSIONS.VENDORS_MANAGE,
    PERMISSIONS.VENDORS_SNAPSHOTS,
    PERMISSIONS.LISTING_SNAPSHOTS,
    PERMISSIONS.DELIVERY_ZONES_VIEW,
    PERMISSIONS.DELIVERY_ZONES_MANAGE,
    PERMISSIONS.BD_TIERS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.REPORTS_MANAGE,
    PERMISSIONS.ACTIVITIES_VIEW,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_CREATE,
    PERMISSIONS.FINANCE_UPDATE,
    PERMISSIONS.FINANCE_DELETE,
  ],

  user: [
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_UPDATE,
    PERMISSIONS.LEADS_CHECK_DUPLICITY,
    PERMISSIONS.GOALS_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BD_TIERS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.ACTIVITIES_VIEW,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.EXTENSION_VIEW,
  ],

  viewer: [
    PERMISSIONS.LEADS_VIEW,
    PERMISSIONS.GOALS_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BD_TIERS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],
};

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS };
