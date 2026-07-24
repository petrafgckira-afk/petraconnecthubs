import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users2, Terminal, Trash2, Lock, Search, CheckCircle, XCircle, Clock, RefreshCw, X, ChevronsRight
} from 'lucide-react';
import {
  fetchAllUsers, updateUserRole, deleteUser,
  fetchAuditLogs, writeAuditLog,
  fetchPendingMembers, approveMember, rejectMember,
  approveUserAccount,
  getSavedUser,
} from '../services/api';

interface ApiAdminUser {
  id: string;
  full_name: string;
  email: string;
  profession: string;
  role: 'member' | 'hub_leader' | 'admin';
  account_status: 'pending' | 'active';
  profile_image: string | null;
  created_at: string;
  membership_id: string | null;
  hub_status: 'pending' | 'approved' | 'rejected' | null;
  hub_name: string | null;
  hub_type: string | null;
}

interface PendingMember {
  membership_id: string;
  user_id: string;
  hub_id: string;
  full_name: string;
  email: string;
  profession: string;
  bio: string;
  profile_image: string | null;
  hub_name: string;
  contribution_interest: string;
  joined_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  detail: string;
  target_id: string | null;
  status: 'success' | 'warning' | 'danger';
  created_at: string;
  performed_by_name: string;
}

export default function AdminPanel() {
  const [usersList, setUsersList]           = useState<ApiAdminUser[]>([]);
  const [pendingList, setPendingList]       = useState<PendingMember[]>([]);
  const [auditLogs, setAuditLogs]           = useState<AuditLog[]>([]);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminLogSearch, setAdminLogSearch]   = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState<'All' | 'success' | 'warning' | 'danger'>('All');
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [logsLoading, setLogsLoading]         = useState(false);
  const [pendingRoles, setPendingRoles]       = useState<Record<string, string>>({});
  const [approvingId, setApprovingId]         = useState<string | null>(null);
  const [showPendingModal, setShowPendingModal]     = useState(false);
  const [approvingAll, setApprovingAll]             = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [failedAvatars, setFailedAvatars]           = useState<Set<string>>(new Set());

  const currentAdminId = getSavedUser()?.id ?? '';
  const currentAdminName = getSavedUser()?.full_name ?? 'Administrator';

  const loadAll = useCallback(() => {
    fetchAllUsers()
      .then(d => setUsersList(d.users || []))
      .catch(() => {});
    fetchPendingMembers()
      .then(d => setPendingList(d.pending || []))
      .catch(() => {});
    setLogsLoading(true);
    fetchAuditLogs()
      .then(d => setAuditLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const id = setInterval(() => loadAll(), 5_000);
    return () => clearInterval(id);
  }, [loadAll]);

  // ── helpers ──────────────────────────────────────────────────────
  const log = (action: string, detail: string, target_id: string | undefined, status: AuditLog['status']) => {
    writeAuditLog({ action, detail, target_id, status })
      .then(() => fetchAuditLogs().then(d => setAuditLogs(d.logs || [])))
      .catch(() => {});
  };

  const markFailed = (id: string) => setFailedAvatars(prev => new Set([...prev, id]));

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // ── role change ──────────────────────────────────────────────────
  const handleRoleChange = (user: ApiAdminUser, newRole: ApiAdminUser['role']) => {
    updateUserRole(user.id, newRole)
      .then(() => {
        setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        log(
          'Role Changed',
          `${currentAdminName} changed ${user.full_name}'s role from ${user.role} → ${newRole}`,
          user.id,
          'warning'
        );
      })
      .catch(() => {});
  };

  // ── delete ───────────────────────────────────────────────────────
  const handleDelete = (user: ApiAdminUser) => {
    setDeletingId(user.id);
    deleteUser(user.id)
      .then(() => {
        setUsersList(prev => prev.filter(u => u.id !== user.id));
        setPendingList(prev => prev.filter(p => p.user_id !== user.id));
        log(
          'Account Deleted',
          `${currentAdminName} permanently deleted account: ${user.full_name} (${user.email})`,
          user.id,
          'danger'
        );
      })
      .catch((err) => {
        log('Delete Failed', `Failed to delete ${user.full_name}: ${err.message}`, user.id, 'warning');
      })
      .finally(() => { setDeletingId(null); setConfirmDeleteId(null); });
  };

  // ── account approval ─────────────────────────────────────────────
  const handleApproveAccount = (user: ApiAdminUser) => {
    const role = pendingRoles[user.id] || 'member';
    setApprovingId(user.id);
    approveUserAccount(user.id, role)
      .then(() => {
        // Reload full user list so hub assignment reflects the auto-approval
        fetchAllUsers()
          .then(d => setUsersList(d.users || []))
          .catch(() => {
            // Fallback: update locally
            setUsersList(prev => prev.map(u =>
              u.id === user.id
                ? { ...u, account_status: 'active', role: role as ApiAdminUser['role'], hub_status: u.hub_status === 'pending' ? 'approved' : u.hub_status }
                : u
            ));
          });
        log(
          'Account Approved',
          `${currentAdminName} approved ${user.full_name}'s account with role: ${role}${user.hub_name ? ` — auto-assigned to ${user.hub_name}` : ''}`,
          user.id,
          'success'
        );
      })
      .catch((err) => {
        log('Approval Failed', `Failed to approve ${user.full_name}: ${err.message}`, user.id, 'warning');
      })
      .finally(() => setApprovingId(null));
  };

  // ── approve all pending accounts ─────────────────────────────────
  const handleApproveAll = () => {
    setApprovingAll(true);
    Promise.allSettled(
      pendingAccounts.map(u =>
        approveUserAccount(u.id, pendingRoles[u.id] || 'member')
      )
    ).then((results) => {
      const succeeded = pendingAccounts.filter((_, i) => results[i].status === 'fulfilled');
      if (succeeded.length > 0) {
        log(
          'Bulk Account Approval',
          `${currentAdminName} bulk-approved ${succeeded.length} account(s) as Member`,
          undefined,
          'success'
        );
      }
      fetchAllUsers()
        .then(d => setUsersList(d.users || []))
        .catch(() => {});
      setShowPendingModal(false);
    }).finally(() => setApprovingAll(false));
  };

  // ── quick hub approve from directory row ─────────────────────────
  const handleQuickApproveHub = (user: ApiAdminUser) => {
    if (!user.membership_id) return;
    approveMember(user.membership_id)
      .then(() => {
        setUsersList(prev => prev.map(u =>
          u.id === user.id ? { ...u, hub_status: 'approved' } : u
        ));
        log(
          'Hub Membership Approved',
          `${currentAdminName} approved ${user.full_name} into ${user.hub_name}`,
          user.id,
          'success'
        );
      })
      .catch(() => {});
  };

  // ── hub approval ─────────────────────────────────────────────────
  const handleApprove = (m: PendingMember) => {
    approveMember(m.membership_id)
      .then(() => {
        setPendingList(prev => prev.filter(p => p.membership_id !== m.membership_id));
        setUsersList(prev => prev.map(u =>
          u.id === m.user_id ? { ...u, hub_status: 'approved', hub_name: m.hub_name } : u
        ));
        log(
          'Hub Membership Approved',
          `${currentAdminName} approved ${m.full_name} into ${m.hub_name}`,
          m.user_id,
          'success'
        );
      })
      .catch(() => {});
  };

  const handleReject = (m: PendingMember) => {
    rejectMember(m.membership_id)
      .then(() => {
        setPendingList(prev => prev.filter(p => p.membership_id !== m.membership_id));
        setUsersList(prev => prev.map(u =>
          u.id === m.user_id ? { ...u, hub_status: 'rejected' } : u
        ));
        log(
          'Hub Membership Rejected',
          `${currentAdminName} rejected ${m.full_name}'s application for ${m.hub_name}`,
          m.user_id,
          'warning'
        );
      })
      .catch(() => {});
  };

  // ── derived counts ───────────────────────────────────────────────
  const totalCount        = usersList.length;
  const approvedCount     = usersList.filter(u => u.hub_status === 'approved').length;
  const pendingCount      = pendingList.length;
  const leadersCount      = usersList.filter(u => u.role === 'hub_leader').length;
  const pendingAccounts   = usersList.filter(u => u.account_status === 'pending');

  const filteredUsers = usersList.filter(u => {
    const q = adminUserSearch.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.hub_name ?? '').toLowerCase().includes(q) ||
      (u.profession ?? '').toLowerCase().includes(q)
    );
  });

  const filteredLogs = auditLogs.filter(log => {
    const q = adminLogSearch.toLowerCase();
    const match = log.action.toLowerCase().includes(q) ||
                  log.detail.toLowerCase().includes(q) ||
                  log.performed_by_name.toLowerCase().includes(q);
    return match && (logFilterStatus === 'All' || log.status === logFilterStatus);
  });

  const statusDot = (s: AuditLog['status']) =>
    s === 'danger' ? 'bg-rose-500' : s === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in font-sans text-navy-950">

      {/* Header banner */}
      <div className="bg-navy-950 p-6 rounded-2xl border-l-4 border-amber-500 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/4 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 bg-navy-900 border border-navy-800 text-amber-500 py-1 px-2 rounded font-mono text-[9px] uppercase tracking-wider w-fit">
              <Lock size={10} /> Sovereign Systems Level Clearance
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-white mb-1">Petra Connect Systems Core</h1>
            <p className="text-gray-300 text-xs">Monitor user directory, manage role clearances, approve hub memberships, and inspect audit logs.</p>
          </div>
          <span className="px-3 py-1 bg-amber-500 text-navy-950 text-xs font-black rounded uppercase font-mono tracking-widest block h-fit shrink-0">Platform Admin Panel</span>
        </div>
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-3xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Directory</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-black text-navy-950">{totalCount}</span>
            <span className="text-[10px] text-gray-500 font-mono">accounts</span>
          </div>
          <p className="text-[9px] text-emerald-600 font-medium">({approvedCount} approved)</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-3xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Pending Approvals</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl md:text-2xl font-black ${(pendingCount + pendingAccounts.length) > 0 ? 'text-amber-500' : 'text-navy-950'}`}>
              {pendingCount + pendingAccounts.length}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">awaiting</span>
          </div>
          <p className="text-[9px] text-gray-400">
            {pendingAccounts.length > 0 && <span className="text-rose-500 font-bold">{pendingAccounts.length} accounts · </span>}
            {pendingCount} hub requests
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-3xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Active Organizers</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-black text-navy-950">{leadersCount}</span>
            <span className="text-[10px] text-gray-500 font-mono">Hub Leads</span>
          </div>
          <p className="text-[9px] text-gray-400">Guiding professional hubs</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-3xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Platform Status</span>
          <div className="text-xl md:text-2xl font-black text-emerald-600 flex items-center gap-1.5 leading-none mt-1">
            Online <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
          </div>
          <p className="text-[9px] text-gray-500 font-mono">XAMPP / MySQL running</p>
        </div>
      </section>

      {/* ── Pending Account Approvals ── */}
      {pendingAccounts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-semibold text-navy-950 flex items-center gap-1.5">
                <Clock size={16} className="text-rose-500" /> Pending Account Registrations
              </h2>
              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingAccounts.length}</span>
            </div>
            <button
              onClick={() => setShowPendingModal(true)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 hover:text-rose-700 transition"
            >
              <ChevronsRight size={13} /> View all
            </button>
          </div>
          <p className="text-[11px] text-gray-500">These users cannot log in until you assign a role and approve their account.</p>

          {/* Preview table — first 4 rows */}
          <div className="bg-white border border-rose-100 rounded-xl overflow-hidden shadow-3xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-rose-50 font-mono text-[10px] text-rose-700 uppercase tracking-wider border-b border-rose-100">
                <tr>
                  <th className="p-3 pl-4">Registrant</th>
                  <th className="p-3">Profession</th>
                  <th className="p-3">Hub Applied</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {pendingAccounts.slice(0, 4).map(u => (
                  <tr key={u.id} className="hover:bg-rose-50/40">
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-2">
                        {u.profile_image && !failedAvatars.has(u.id) ? (
                          <img src={u.profile_image} alt={u.full_name} className="w-7 h-7 rounded-full object-cover border border-rose-200 shrink-0" onError={() => markFailed(u.id)} />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-navy-900 text-white text-[9px] font-bold font-serif flex items-center justify-center shrink-0 border border-rose-200">
                            {getInitials(u.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-[11px] text-navy-950 truncate max-w-[120px]">{u.full_name}</p>
                          <p className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-[10px] text-gray-600">{u.profession || '—'}</td>
                    <td className="p-3">
                      <span className="bg-navy-50 text-navy-700 font-bold text-[9px] px-2 py-0.5 rounded border border-navy-100">
                        {u.hub_name ?? '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        value={pendingRoles[u.id] ?? 'member'}
                        onChange={e => setPendingRoles(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="border border-slate-200 rounded px-1.5 py-1 text-[10px] font-bold text-navy-950 bg-white focus:outline-none focus:border-brand-gold"
                      >
                        <option value="member">Member</option>
                        <option value="hub_leader">Hub Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-3 pr-4">
                      <button
                        onClick={() => handleApproveAccount(u)}
                        disabled={approvingId === u.id}
                        className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition disabled:opacity-60 whitespace-nowrap"
                      >
                        <CheckCircle size={11} />
                        {approvingId === u.id ? 'Approving…' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* See more footer */}
            <button
              onClick={() => setShowPendingModal(true)}
              className="w-full py-2.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border-t border-rose-100 transition flex items-center justify-center gap-1.5"
            >
              <ChevronsRight size={12} />
              {pendingAccounts.length > 4
                ? `See ${pendingAccounts.length - 4} more · Open full panel`
                : 'Open full panel · Approve All'}
            </button>
          </div>
        </section>
      )}

      {/* ── Pending Accounts Modal ── */}
      {showPendingModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-950/75 backdrop-blur-sm"
            onClick={() => !approvingAll && setShowPendingModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[88vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-rose-500" />
                <h3 className="font-serif text-base font-bold text-navy-950">
                  All Pending Registrations
                </h3>
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingAccounts.length}</span>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                disabled={approvingAll}
                className="p-1.5 text-gray-400 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 font-mono text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="p-3.5 pl-6">#</th>
                    <th className="p-3.5">Registrant</th>
                    <th className="p-3.5">Profession</th>
                    <th className="p-3.5">Hub Applied</th>
                    <th className="p-3.5">Assign Role</th>
                    <th className="p-3.5 pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingAccounts.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="p-3.5 pl-6 text-[10px] text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {u.profile_image && !failedAvatars.has(u.id) ? (
                            <img src={u.profile_image} alt={u.full_name} className="w-8 h-8 rounded-full object-cover border border-rose-200 shrink-0" onError={() => markFailed(u.id)} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-navy-900 text-white text-[10px] font-bold font-serif flex items-center justify-center shrink-0 border border-rose-200">
                              {getInitials(u.full_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[11px] text-navy-950 truncate max-w-[150px]">{u.full_name}</p>
                            <p className="text-[9px] text-gray-400 font-mono truncate max-w-[150px]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-[10px] text-gray-600">{u.profession || '—'}</td>
                      <td className="p-3.5">
                        <span className="bg-navy-50 text-navy-700 font-bold text-[9px] px-2 py-0.5 rounded border border-navy-100 whitespace-nowrap">
                          {u.hub_name ?? '—'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={pendingRoles[u.id] ?? 'member'}
                          onChange={e => setPendingRoles(prev => ({ ...prev, [u.id]: e.target.value }))}
                          disabled={approvingAll}
                          className="border border-slate-200 rounded px-1.5 py-1 text-[10px] font-bold text-navy-950 bg-white focus:outline-none focus:border-brand-gold disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="hub_leader">Hub Leader</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-3.5 pr-6">
                        <button
                          onClick={() => handleApproveAccount(u)}
                          disabled={approvingId === u.id || approvingAll}
                          className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 whitespace-nowrap"
                        >
                          <CheckCircle size={11} />
                          {approvingId === u.id ? 'Approving…' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal footer — APPROVE ALL */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-navy-950">{pendingAccounts.length} registrations awaiting activation</p>
                <p className="text-[10px] text-gray-500">Default role is <span className="font-bold text-navy-700">Member</span> unless changed above.</p>
              </div>
              <button
                onClick={handleApproveAll}
                disabled={approvingAll || pendingAccounts.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-5 py-2.5 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider shadow-md"
              >
                <CheckCircle size={14} />
                {approvingAll ? 'Approving All…' : `Approve All (${pendingAccounts.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Pending Hub Approvals ── */}
      {pendingList.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base font-semibold text-navy-950 flex items-center gap-1.5">
              <Clock size={16} className="text-amber-500" /> Pending Hub Membership Requests
              <span className="ml-1 bg-amber-500 text-navy-950 text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingList.length}</span>
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pendingList.map(m => (
              <div key={m.membership_id} className="bg-white border border-amber-100 rounded-xl p-4 space-y-3 shadow-3xs">
                <div className="flex items-start gap-3">
                  {m.profile_image && !failedAvatars.has(m.user_id) ? (
                    <img src={m.profile_image} alt={m.full_name} className="w-9 h-9 rounded-full object-cover border border-brand-gold shrink-0" onError={() => markFailed(m.user_id)} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-navy-900 text-white text-[10px] font-bold font-serif flex items-center justify-center shrink-0 border border-brand-gold">
                      {getInitials(m.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-navy-950 truncate">{m.full_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{m.email}</p>
                    <span className="inline-block mt-0.5 bg-navy-50 text-navy-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-navy-100">{m.hub_name}</span>
                  </div>
                </div>
                {m.profession && (
                  <p className="text-[10px] text-gray-500"><span className="font-semibold text-navy-700">Profession:</span> {m.profession}</p>
                )}
                {m.contribution_interest && (
                  <p className="text-[10px] text-gray-500 line-clamp-2"><span className="font-semibold text-navy-700">Proposal:</span> {m.contribution_interest}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleApprove(m)}
                    className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(m)}
                    className="flex-1 flex items-center justify-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-rose-100 transition"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── User Directory + Audit Log ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* LEFT: Directory preview */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="font-serif text-base font-semibold text-navy-950 flex items-center gap-1.5">
                <Users2 size={16} /> Directory Access Control
              </h2>
              <p className="text-[11px] text-gray-500">Alter platform user roles or remove stale accounts.</p>
            </div>
            <button
              onClick={() => setShowDirectoryModal(true)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-navy-700 hover:text-navy-950 transition"
            >
              <ChevronsRight size={13} /> View all
            </button>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-3xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 font-mono text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3.5 pl-4">Account</th>
                  <th className="p-3.5">Profession</th>
                  <th className="p-3.5">Hub</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-right pr-4">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-navy-950">
                {usersList.slice(0, 5).map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50">
                    <td className="p-3.5 pl-4">
                      <div className="flex items-center gap-2.5">
                        {user.profile_image && !failedAvatars.has(user.id) ? (
                          <img src={user.profile_image} alt={user.full_name} className="w-8 h-8 rounded-full border border-brand-gold object-cover shrink-0" onError={() => markFailed(user.id)} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-navy-900 border border-brand-gold text-white font-bold font-serif text-[10px] flex items-center justify-center shrink-0">
                            {getInitials(user.full_name)}
                          </div>
                        )}
                        <div className="truncate max-w-[130px]">
                          <span className="font-bold text-xs text-navy-950 block truncate leading-tight">{user.full_name}</span>
                          <span className="text-[9.5px] text-gray-400 block font-mono truncate">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] text-gray-600">{user.profession || '—'}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-navy-50 text-navy-700 font-bold text-[10px] px-2 py-0.5 rounded border border-navy-100 truncate max-w-[110px] block">
                        {user.hub_name ?? '—'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        user.role === 'admin'       ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : user.role === 'hub_leader' ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {user.role === 'hub_leader' ? 'Hub Lead' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-4 text-[10px] text-gray-400 italic">—</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* See more footer */}
            <button
              onClick={() => setShowDirectoryModal(true)}
              className="w-full py-2.5 text-[10px] font-bold text-navy-700 hover:bg-gray-50 border-t border-slate-100 transition flex items-center justify-center gap-1.5"
            >
              <ChevronsRight size={12} />
              {usersList.length > 5
                ? `See ${usersList.length - 5} more accounts · Open full directory`
                : 'Open full directory'}
            </button>
          </div>
        </section>

        {/* ── Directory Modal ── */}
        {showDirectoryModal && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-navy-950/75 backdrop-blur-sm"
              onClick={() => setShowDirectoryModal(false)}
            />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[88vh]">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <Users2 size={16} className="text-navy-700" />
                  <h3 className="font-serif text-base font-bold text-navy-950">Full Directory</h3>
                  <span className="bg-navy-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{usersList.length}</span>
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="text"
                    value={adminUserSearch}
                    onChange={e => setAdminUserSearch(e.target.value)}
                    placeholder="Search name, email, hub..."
                    className="w-full bg-gray-50 border border-slate-200 rounded-lg py-1.5 pl-7 pr-3 text-[10.5px] text-navy-950 focus:outline-none focus:border-brand-gold"
                  />
                </div>
                <button
                  onClick={() => setShowDirectoryModal(false)}
                  className="p-1.5 text-gray-400 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition shrink-0"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable table */}
              <div className="overflow-y-auto flex-1 min-h-0">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 font-mono text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="p-3.5 pl-6">#</th>
                      <th className="p-3.5">Account</th>
                      <th className="p-3.5">Profession</th>
                      <th className="p-3.5">Hub</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5 text-right pr-6">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-navy-950">
                    {filteredUsers.map((user, idx) => (
                      <tr key={user.id} className="hover:bg-slate-50/60">
                        <td className="p-3.5 pl-6 text-[10px] text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            {user.profile_image && !failedAvatars.has(user.id) ? (
                              <img src={user.profile_image} alt={user.full_name} className="w-8 h-8 rounded-full border border-brand-gold object-cover shrink-0" onError={() => markFailed(user.id)} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-navy-900 border border-brand-gold text-white font-bold font-serif text-[10px] flex items-center justify-center shrink-0">
                                {getInitials(user.full_name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-navy-950 block truncate max-w-[150px] leading-tight">{user.full_name}</span>
                              <span className="text-[9.5px] text-gray-400 block font-mono truncate max-w-[150px]">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] text-gray-600">{user.profession || '—'}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="bg-navy-50 text-navy-700 font-bold text-[10px] px-2 py-0.5 rounded border border-navy-100 truncate max-w-[110px]">
                              {user.hub_name ?? '—'}
                            </span>
                            {user.hub_status === 'pending' && user.membership_id && (
                              <button
                                onClick={() => handleQuickApproveHub(user)}
                                className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-100 transition w-fit whitespace-nowrap"
                              >
                                ✓ Approve Hub
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user, e.target.value as ApiAdminUser['role'])}
                            disabled={user.id === currentAdminId}
                            className={`border rounded p-1 text-[10px] font-bold focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              user.role === 'admin'       ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : user.role === 'hub_leader' ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            <option value="member">Member</option>
                            <option value="hub_leader">Hub Lead</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="p-3.5 text-right pr-6">
                          {confirmDeleteId === user.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDelete(user)}
                                disabled={!!deletingId}
                                className="text-[9px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded transition disabled:opacity-60"
                              >
                                {deletingId === user.id ? '...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[9px] font-bold text-gray-500 hover:text-navy-950 px-2 py-1 rounded border border-gray-200 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(user.id)}
                              disabled={user.id === currentAdminId || user.role === 'admin'}
                              title={user.role === 'admin' ? 'Cannot delete admin accounts' : user.id === currentAdminId ? 'Cannot delete yourself' : 'Delete account'}
                              className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition disabled:opacity-30 disabled:cursor-not-allowed ml-auto block"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between shrink-0">
                <p className="text-[10px] text-gray-500 font-mono">
                  Showing <span className="font-bold text-navy-950">{filteredUsers.length}</span> of <span className="font-bold text-navy-950">{usersList.length}</span> accounts
                </p>
                <button
                  onClick={() => setShowDirectoryModal(false)}
                  className="text-[10px] font-bold text-gray-500 hover:text-navy-950 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* RIGHT: Audit log */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="font-serif text-base font-semibold text-navy-950 flex items-center gap-1.5">
                <Terminal size={16} /> Audit Logger
              </h2>
              <p className="text-[11px] text-gray-500">Persistent log of all admin actions.</p>
            </div>
            <button onClick={loadAll} className="p-1.5 text-gray-400 hover:text-navy-950 hover:bg-gray-100 rounded-lg transition" title="Refresh">
              <RefreshCw size={13} />
            </button>
          </div>

          <div className="bg-navy-950 p-4 rounded-xl border border-navy-900 text-white space-y-3 font-mono text-[10.5px]">
            <div className="flex gap-2">
              <input
                type="text"
                value={adminLogSearch}
                onChange={(e) => setAdminLogSearch(e.target.value)}
                placeholder="Search actions..."
                className="bg-navy-900 border border-navy-800 rounded px-2 py-1 text-[10px] text-white flex-1 focus:outline-none focus:border-brand-gold"
              />
              <select
                value={logFilterStatus}
                onChange={(e) => setLogFilterStatus(e.target.value as any)}
                className="bg-navy-900 border border-navy-800 rounded px-2 py-1 text-[10px] focus:outline-none"
              >
                <option value="All">All</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </div>

            <div className="h-[320px] overflow-y-auto pr-1 space-y-2">
              {logsLoading ? (
                <div className="flex items-center justify-center h-full text-gray-600 text-[10px]">Loading logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-600 text-[10px]">No audit entries yet</div>
              ) : filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-2.5 rounded border leading-relaxed ${
                    entry.status === 'danger'  ? 'border-rose-900/40 bg-rose-950/20 text-rose-300'
                    : entry.status === 'warning' ? 'border-amber-900/40 bg-amber-950/10 text-amber-200'
                    : 'border-slate-800 bg-navy-900/60 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-[9.5px]">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                      {entry.action}
                    </span>
                    <span className="text-[8.5px] text-gray-600 shrink-0 ml-1">
                      {entry.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">{entry.detail}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-navy-900 flex justify-between text-[9px] text-gray-500">
              <span>{auditLogs.length} entries recorded</span>
              <span>Petra Connect Systems</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
