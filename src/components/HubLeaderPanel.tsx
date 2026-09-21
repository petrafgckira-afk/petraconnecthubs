import React, { useState, useEffect, useCallback } from 'react';
import { HubType, HubAnnouncement, HubEvent, HubResource, UserRole } from '../types';
import LucideIcon from './LucideIcon';
import {
  Users, Check, X, Megaphone, Calendar, FilePlus,
  Plus, CornerDownRight, ClipboardList, UserX, ShieldCheck
} from 'lucide-react';
import { fetchPendingMembers, approveMember, rejectMember, getFrozenUsers, unfreezeFeedUser } from '../services/api';

interface FrozenUser {
  id: string;
  user_id: string;
  hub_id: string | null;
  full_name: string;
  email: string;
  profile_image: string | null;
  hub_name: string | null;
  frozen_by_name: string;
  reason: string | null;
  created_at: string;
}

interface PendingApplicant {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  profession: string;
  bio: string | null;
  contribution_interest: string | null;
  joined_at: string;
  hub_name: string;
  profile_image: string | null;
}

interface HubLeaderPanelProps {
  userHub: HubType;
  userRole: UserRole;
  adminHubScope?: { hubId: string | null; hubName: string | null };
  onCreateAnnouncement: (ann: Partial<HubAnnouncement>) => Promise<void>;
  onCreateEvent: (evt: Partial<HubEvent>) => void;
  onCreateResource: (res: Partial<HubResource>) => void;
  userName: string;
}

export default function HubLeaderPanel({
  userHub,
  userRole,
  adminHubScope,
  onCreateAnnouncement,
  onCreateEvent,
  onCreateResource,
  userName
}: HubLeaderPanelProps) {

  const [activeLeaderTab, setActiveLeaderTab] = useState<'approvals' | 'announcements' | 'events' | 'resources' | 'suspended'>('approvals');
  const [frozenUsers, setFrozenUsers]   = useState<FrozenUser[]>([]);
  const [unfreezingId, setUnfreezingId] = useState<string | null>(null);
  const [frozenAvatarFails, setFrozenAvatarFails] = useState<Set<string>>(new Set());
  const [pendingApplicants, setPendingApplicants] = useState<PendingApplicant[]>([]);
  const [failedApplicantAvatars, setFailedApplicantAvatars] = useState<Set<string>>(new Set());
  const markApplicantFailed = (id: string) => setFailedApplicantAvatars(prev => new Set([...prev, id]));

  // Form states: Announcements
  const [annTitle, setAnnTitle]         = useState('');
  const [annContent, setAnnContent]     = useState('');
  const [annSuccess, setAnnSuccess]     = useState(false);
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [annError, setAnnError]         = useState('');

  // Form states: Events
  const [evtTitle, setEvtTitle]             = useState('');
  const [evtDesc, setEvtDesc]               = useState('');
  const [evtDate, setEvtDate]               = useState('');
  const [evtTime, setEvtTime]               = useState('');
  const [evtPlace, setEvtPlace]             = useState('');
  const [evtSpeaker, setEvtSpeaker]         = useState('');
  const [evtSpeakerTitle, setEvtSpeakerTitle] = useState('');
  const [evtSuccess, setEvtSuccess]         = useState(false);

  // Form states: Resources
  const [resTitle, setResTitle] = useState('');
  const [resDesc, setResDesc]   = useState('');
  const [resType, setResType]   = useState<'pdf' | 'doc' | 'link' | 'video'>('pdf');
  const [resSize, setResSize]   = useState('1.5 MB');
  const [resSuccess, setResSuccess] = useState(false);

  const loadApplicants = useCallback(() => {
    fetchPendingMembers()
      .then(data => setPendingApplicants(data.pending || []))
      .catch(() => {});
    getFrozenUsers()
      .then(d => setFrozenUsers(d.frozen || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadApplicants(); }, [loadApplicants]);

  useEffect(() => {
    const id = setInterval(() => loadApplicants(), 5_000);
    return () => clearInterval(id);
  }, [loadApplicants]);

  const handleUnfreeze = (fu: FrozenUser) => {
    setUnfreezingId(fu.user_id);
    unfreezeFeedUser(fu.user_id, fu.hub_id)
      .then(() => {
        setFrozenUsers(prev => prev.filter(f => !(f.user_id === fu.user_id && f.hub_id === fu.hub_id)));
      })
      .catch(() => {})
      .finally(() => setUnfreezingId(null));
  };

  const handleApprove = (applicant: PendingApplicant) => {
    approveMember(applicant.membership_id)
      .then(() => setPendingApplicants(prev => prev.filter(a => a.membership_id !== applicant.membership_id)))
      .catch(() => {});
  };

  const handleReject = (applicant: PendingApplicant) => {
    rejectMember(applicant.membership_id)
      .then(() => setPendingApplicants(prev => prev.filter(a => a.membership_id !== applicant.membership_id)))
      .catch(() => {});
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n.length ? n[0] : '').join('').toUpperCase().slice(0, 2);

  // ── Scope derivations ─────────────────────────────────────────────────────
  const isAdmin          = userRole === 'admin';
  const isAllHubs        = isAdmin && !adminHubScope?.hubId;
  const hasSpecificScope = isAdmin && !!adminHubScope?.hubId;

  // Strip the " Hub" suffix so we get back the plain HubType string
  const scopedHubName    = adminHubScope?.hubName?.replace(/ Hub$/, '') ?? null;

  // The hub this panel is currently operating on
  const effectiveHub: HubType = (hasSpecificScope && scopedHubName)
    ? (scopedHubName as HubType)
    : userHub;

  // hubTarget drives announcement / event hubId:
  //   admins with no specific scope → 'All' (platform-wide)
  //   everyone else → their effective hub
  const hubTarget: HubType | 'All' = isAllHubs ? 'All' : effectiveHub;

  // Visual title
  const panelTitle = isAllHubs
    ? 'Platform Administration Office'
    : `${effectiveHub} Hub Lead Office`;

  // Pending list: admin-all shows all; scoped admin or leader filters to their hub
  const targetPending = isAllHubs
    ? pendingApplicants
    : pendingApplicants.filter(a => a.hub_name === `${effectiveHub} Hub`);

  const handleAnnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setAnnSubmitting(true);
    setAnnError('');
    try {
      await onCreateAnnouncement({
        title: annTitle,
        content: annContent,
        hubId: hubTarget,
        authorName: userName,
        authorRole: isAdmin
          ? (isAllHubs ? 'Platform Administrator' : `${effectiveHub} Hub Admin`)
          : `${userHub} Hub Lead`,
        authorAvatar: userName.split(' ').map(n => n.length ? n[0] : '').join('').substring(0, 2) || 'LD',
      });
      setAnnTitle('');
      setAnnContent('');
      setAnnSuccess(true);
      setTimeout(() => setAnnSuccess(false), 4000);
    } catch {
      setAnnError('Failed to post bulletin. Please check your connection and try again.');
    } finally {
      setAnnSubmitting(false);
    }
  };

  const handleEvtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtDesc.trim() || !evtDate.trim()) return;

    onCreateEvent({
      title: evtTitle,
      description: evtDesc,
      date: evtDate,
      time: evtTime || '19:00 - 21:00',
      location: evtPlace || 'Regional Classroom Alpha',
      speakerName: evtSpeaker || undefined,
      speakerTitle: evtSpeakerTitle || undefined,
      hubId: hubTarget
    });

    setEvtTitle('');
    setEvtDesc('');
    setEvtDate('');
    setEvtTime('');
    setEvtPlace('');
    setEvtSpeaker('');
    setEvtSpeakerTitle('');
    setEvtSuccess(true);
    setTimeout(() => setEvtSuccess(false), 4000);
  };

  const handleResSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resDesc.trim()) return;

    onCreateResource({
      title: resTitle,
      description: resDesc,
      fileType: resType,
      fileSize: resType !== 'link' ? resSize : undefined,
      uploadedBy: userName,
      hubId: effectiveHub
    });

    setResTitle('');
    setResDesc('');
    setResType('pdf');
    setResSize('1.5 MB');
    setResSuccess(true);
    setTimeout(() => setResSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in font-sans text-navy-950">
      
      {/* Page header and current hub context */}
      <div className="bg-white rounded-2xl border border-navy-100 p-6 md:p-8 shadow-xs">
        <div className="space-y-1">
          <span className="text-brand-gold font-serif font-bold text-xs uppercase tracking-wider">
            Steward Management Desk
          </span>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-navy-950">
            {panelTitle}
          </h1>
          <p className="text-gray-500 text-sm">
            Review applicant vocational proposals, post target bulletins, schedule fellowships, and approve resources.
          </p>
          {/* Hub scope indicator badge */}
          <div className="pt-1">
            {isAllHubs ? (
              <span className="inline-flex items-center text-[9px] font-bold bg-navy-50 text-navy-500 border border-navy-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Scope: All Hubs (Platform-Wide)
              </span>
            ) : (
              <span className="inline-flex items-center text-[9px] font-bold bg-brand-gold-light text-amber-900 border border-brand-gold/25 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Scope: {effectiveHub} Hub
              </span>
            )}
          </div>
        </div>

        {/* Local Management controls tabs selector */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-50 mt-6 select-none">
          <button
            onClick={() => setActiveLeaderTab('approvals')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeLeaderTab === 'approvals'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-50 hover:bg-slate-100 text-gray-500'
            }`}
          >
            <Users size={14} />
            Applicant Approvals ({targetPending.length})
          </button>
          
          <button
            onClick={() => setActiveLeaderTab('announcements')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeLeaderTab === 'announcements'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-50 hover:bg-slate-100 text-gray-500'
            }`}
          >
            <Megaphone size={14} />
            Create Bulletin Post
          </button>

          <button
            onClick={() => setActiveLeaderTab('events')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeLeaderTab === 'events'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-50 hover:bg-slate-100 text-gray-500'
            }`}
          >
            <Calendar size={14} />
            Schedule Meet / Event
          </button>

          <button
            onClick={() => setActiveLeaderTab('resources')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeLeaderTab === 'resources'
                ? 'bg-navy-900 text-white'
                : 'bg-slate-50 hover:bg-slate-100 text-gray-500'
            }`}
          >
            <FilePlus size={14} />
            Share Resource File
          </button>

          <button
            onClick={() => setActiveLeaderTab('suspended')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeLeaderTab === 'suspended'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-50 hover:bg-slate-100 text-gray-500'
            }`}
          >
            <UserX size={14} />
            Suspended Postings
            {frozenUsers.length > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ml-0.5 ${
                activeLeaderTab === 'suspended' ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
              }`}>{frozenUsers.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: APPLICANT APPROVALS */}
      {activeLeaderTab === 'approvals' && (
        <section className="space-y-4 animate-fade-in">
          <div className="space-y-0.5">
            <h2 className="font-serif text-lg font-semibold text-navy-950">Pending Candidates. ({targetPending.length})</h2>
            <p className="text-xs text-gray-500">
              {isAllHubs
                ? 'Please review all pending applicants across every hub.'
                : `Please review candidates intending to engage the ${effectiveHub} Hub.`}
            </p>
          </div>

          {targetPending.length === 0 ? (
            <div className="bg-white border rounded-xl p-10 text-center text-gray-400 space-y-2">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <Check size={20} />
              </div>
              <h3 className="font-bold text-navy-950 text-xs">All Registrations Resolved</h3>
              <p className="text-[11px] max-w-sm mx-auto">No pending applications for your Hub right now. New applicants will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {targetPending.map((applicant) => (
                <div
                  key={applicant.membership_id}
                  className="bg-white border border-slate-100 rounded-xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row justify-between gap-5 hover:border-slate-200 transition"
                >
                  <div className="space-y-4 flex-1">
                    <div className="flex gap-3 items-start">
                      {applicant.profile_image && !failedApplicantAvatars.has(applicant.user_id) ? (
                        <img
                          src={applicant.profile_image}
                          alt={applicant.full_name}
                          className="w-10 h-10 rounded-full border border-brand-gold/40 object-cover shrink-0"
                          onError={() => markApplicantFailed(applicant.user_id)}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-navy-900 text-brand-gold border border-brand-gold/40 font-bold font-serif flex items-center justify-center text-xs shrink-0">
                          {getInitials(applicant.full_name)}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-xs text-navy-950">{applicant.full_name}</h4>
                        <span className="text-[10px] text-gray-400 block font-mono">
                          {applicant.email} • {applicant.joined_at?.substring(0, 10)}
                        </span>
                        <span className="text-[10px] text-amber-800 font-bold">{applicant.hub_name}</span>
                      </div>
                    </div>

                    <div className="pl-3 border-l-2 border-slate-100 text-xs text-gray-600 max-w-2xl text-justify">
                      <p><span className="font-bold text-navy-900 block font-sans">Professional Bio:</span> "{applicant.bio || 'Not provided'}"</p>
                    </div>

                    {applicant.contribution_interest && (
                      <div className="p-3 bg-amber-50/40 rounded-lg flex gap-1.5 items-start text-xs border border-amber-200/25">
                        <CornerDownRight size={14} className="text-brand-gold shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-950 uppercase tracking-widest text-[9px] block">Stewardship Proposal</span>
                          <p className="text-gray-700 italic text-[11px] leading-relaxed">"{applicant.contribution_interest}"</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:border-l md:border-dashed border-gray-100 md:pl-6 flex md:flex-col justify-end gap-2.5 shrink-0 self-center md:self-stretch justify-center">
                    <button
                      onClick={() => handleApprove(applicant)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(applicant)}
                      className="border border-slate-200 hover:border-red-500 hover:bg-red-50 text-gray-500 hover:text-red-600 font-medium text-xs py-2 px-4 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X size={13} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUB-VIEW 2: WRITE ANNOUNCEMENT */}
      {activeLeaderTab === 'announcements' && (
        <form onSubmit={handleAnnSubmit} className="bg-white border rounded-xl p-6 md:p-8 shadow-xs max-w-2xl space-y-4 animate-fade-in border-slate-100">
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-semibold text-navy-950 flex items-center gap-1.5">
              <Megaphone size={18} className="text-brand-gold" />
              Write Bulletin Post
            </h2>
            <p className="text-gray-500 text-xs">
              {isAllHubs
                ? 'Your posted bulletin is distributed platform-wide to all hub members.'
                : `Your posted bulletin is distributed onto dashboards for all approved ${effectiveHub} Hub peers.`}
            </p>
          </div>

          {annSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg text-xs font-bold text-center">
              Bulletin posted successfully! Redirecting to Dashboard…
            </div>
          )}
          {annError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-lg text-xs font-medium text-center">
              {annError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5" id="ann-title-group">
              <label htmlFor="ann-title" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Short Title / Subject</label>
              <input
                id="ann-title"
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. Mastermind Peer Review Next Tuesday"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition"
                required
              />
            </div>

            <div className="space-y-1.5" id="ann-content-group">
              <label htmlFor="ann-content" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Main Message content</label>
              <textarea
                id="ann-content"
                rows={5}
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder="Type important guidelines, alerts, bootcamps, or vocational prayer requests..."
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition leading-relaxed"
                required
              />
            </div>

            <button
              type="submit"
              disabled={annSubmitting}
              className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs py-2.5 px-5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> {annSubmitting ? 'Posting…' : 'Distribute Bulletin'}
            </button>
          </div>
        </form>
      )}

      {/* SUB-VIEW 3: SCHEDULE EVENTS */}
      {activeLeaderTab === 'events' && (
        <form onSubmit={handleEvtSubmit} className="bg-white border rounded-xl p-6 md:p-8 shadow-xs max-w-2xl space-y-4 animate-fade-in border-slate-100">
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-semibold text-navy-950 flex items-center gap-1.5">
              <Calendar size={18} className="text-brand-gold" />
              Schedule Hub Meeting.
            </h2>
            <p className="text-gray-500 text-xs text-justify">Roster a strategic professional meet or Zoom presentation on the dashboard. Local managers coordinate security desks.</p>
          </div>

          {evtSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-bold text-center">
              Strategic fellowship scheduled! Checked inside formation feeds on Dashboard.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2" id="evt-title-group">
              <label htmlFor="evt-title" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Meeting Designation / Title</label>
              <input
                id="evt-title"
                type="text"
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                placeholder="e.g. AI Ethics panel or Christian Budgeting blueprint"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition"
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2" id="evt-desc-group">
              <label htmlFor="evt-desc" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Agenda Description</label>
              <textarea
                id="evt-desc"
                rows={2}
                value={evtDesc}
                onChange={(e) => setEvtDesc(e.target.value)}
                placeholder="Summarize coordinates, expectations, and target achievements..."
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition"
                required
              />
            </div>

            <div className="space-y-1.5" id="evt-date-group">
              <label htmlFor="evt-date" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Calendar Date</label>
              <input
                id="evt-date"
                type="date"
                value={evtDate}
                onChange={(e) => setEvtDate(e.target.value)}
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2 text-xs text-navy-950 focus:outline-hidden"
                required
              />
            </div>

            <div className="space-y-1.5" id="evt-time-group">
              <label htmlFor="evt-time" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Hours / Time Space</label>
              <input
                id="evt-time"
                type="text"
                value={evtTime}
                onChange={(e) => setEvtTime(e.target.value)}
                placeholder="e.g. 19:30 - 21:00 UTC"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2 text-xs text-navy-950 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2" id="evt-place-group">
              <label htmlFor="evt-place" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block font-sans">Precise Location or Zoom linkage</label>
              <input
                id="evt-place"
                type="text"
                value={evtPlace}
                onChange={(e) => setEvtPlace(e.target.value)}
                placeholder="e.g. Sanctuary Annex Classroom B • Zoom Link"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1.5" id="evt-speaker-group">
              <label htmlFor="evt-speaker" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Keynote Host / Speaker</label>
              <input
                id="evt-speaker"
                type="text"
                value={evtSpeaker}
                onChange={(e) => setEvtSpeaker(e.target.value)}
                placeholder="e.g. Ndyamuhaki Abraham"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2 text-xs text-navy-950 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1.5" id="evt-speaker-title-group">
              <label htmlFor="evt-speaker-title" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block font-sans">Speaker Profession / Title</label>
              <input
                id="evt-speaker-title"
                type="text"
                value={evtSpeakerTitle}
                onChange={(e) => setEvtSpeakerTitle(e.target.value)}
                placeholder="e.g. Staff Architect at Stripe"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2 text-xs text-navy-950 focus:outline-hidden"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs py-2.5 px-5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer mt-2"
          >
            <Plus size={14} /> Commit Fellowship agenda
          </button>
        </form>
      )}

      {/* SUB-VIEW 4: SHARE RESOURCES */}
      {activeLeaderTab === 'resources' && (
        <form onSubmit={handleResSubmit} className="bg-white border rounded-xl p-6 md:p-8 shadow-xs max-w-2xl space-y-4 animate-fade-in border-slate-100">
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-semibold text-navy-950 flex items-center gap-1.5">
              <ClipboardList size={18} className="text-brand-gold" />
              Upload Mentorship or Guidance File
            </h2>
            <p className="text-gray-500 text-xs">
              {isAllHubs
                ? `Publish useful templates, worksheets, or guidelines into a specific Hub resource center.`
                : `Publish useful templates, worksheets, or guidelines into the ${effectiveHub} Hub resource center.`}
            </p>
          </div>

          {/* All-Hubs guard: resources must target a specific hub */}
          {isAllHubs && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3.5 text-xs text-amber-800 font-medium">
              Resources must target a specific hub. Use the hub scope picker in the sidebar to select a hub before publishing a resource file.
            </div>
          )}

          {resSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-bold text-center">
              Resource cataloged! Track download indices directly in My Hub space file panels.
            </div>
          )}

          <fieldset disabled={isAllHubs} className="space-y-4 disabled:opacity-40 disabled:pointer-events-none">
            <div className="space-y-1.5" id="res-title-group">
              <label htmlFor="res-title" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Document Title</label>
              <input
                id="res-title"
                type="text"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="e.g. 2026 SME Charity Tax Shield Checklist"
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition"
                required={!isAllHubs}
              />
            </div>

            <div className="space-y-1.5" id="res-desc-group">
              <label htmlFor="res-desc" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block text-sans">File Description / Explainer</label>
              <textarea
                id="res-desc"
                rows={3}
                value={resDesc}
                onChange={(e) => setResDesc(e.target.value)}
                placeholder="Give peers precise guidance on how to utility structure this template document..."
                className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition"
                required={!isAllHubs}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5" id="res-type-group">
                <label htmlFor="res-type" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Asset Type</label>
                <select
                  id="res-type"
                  value={resType}
                  onChange={(e) => setResType(e.target.value as any)}
                  className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-900 focus:outline-hidden"
                >
                  <option value="pdf">Acrobat PDF File</option>
                  <option value="doc">Word / Excel Sheet</option>
                  <option value="link">Github Repo / Web link</option>
                  <option value="video">Vimeo / Video presentation</option>
                </select>
              </div>

              {resType !== 'link' && (
                <div className="space-y-1.5" id="res-size-group">
                  <label htmlFor="res-size" className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Simulated Size</label>
                  <input
                    id="res-size"
                    type="text"
                    value={resSize}
                    onChange={(e) => setResSize(e.target.value)}
                    placeholder="e.g. 2.4 MB"
                    className="w-full bg-navy-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-navy-900 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs py-2.5 px-5 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Catalog Asset File
            </button>
          </fieldset>
        </form>
      )}

      {/* SUB-VIEW 5: SUSPENDED POSTINGS */}
      {activeLeaderTab === 'suspended' && (
        <section className="space-y-4 animate-fade-in">
          <div className="space-y-0.5">
            <h2 className="font-serif text-lg font-semibold text-navy-950 flex items-center gap-2">
              <UserX size={18} className="text-rose-500" /> Suspended Postings
            </h2>
            <p className="text-xs text-gray-500">
              {isAllHubs
                ? 'All users suspended from posting across the platform.'
                : `Members in the ${effectiveHub} Hub whose posting has been suspended.`}
            </p>
          </div>

          {frozenUsers.length === 0 ? (
            <div className="bg-white border rounded-xl p-10 text-center text-gray-400 space-y-2">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={20} className="text-emerald-500" />
              </div>
              <h3 className="font-bold text-navy-950 text-xs">No suspended members</h3>
              <p className="text-[11px] max-w-sm mx-auto">
                {isAllHubs ? 'All members have active posting access.' : `No members in the ${effectiveHub} Hub are currently suspended.`}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-rose-100 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-rose-50 font-mono text-[10px] text-rose-700 uppercase tracking-wider border-b border-rose-100">
                  <tr>
                    <th className="p-3 pl-4">Member</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Suspended By</th>
                    <th className="p-3">Since</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {frozenUsers.map(fu => (
                    <tr key={fu.id} className="hover:bg-rose-50/40">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2">
                          {fu.profile_image && !frozenAvatarFails.has(fu.user_id) ? (
                            <img
                              src={fu.profile_image}
                              alt={fu.full_name}
                              className="w-7 h-7 rounded-full object-cover border border-rose-200 shrink-0"
                              onError={() => setFrozenAvatarFails(p => new Set([...p, fu.user_id]))}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-navy-900 text-white text-[9px] font-bold font-serif flex items-center justify-center shrink-0 border border-rose-200">
                              {getInitials(fu.full_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[11px] text-navy-950 truncate max-w-[120px]">{fu.full_name}</p>
                            <p className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]">{fu.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          fu.hub_id
                            ? 'bg-navy-50 text-navy-700 border-navy-100'
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {fu.hub_id ? (fu.hub_name ?? 'Hub') : 'Platform-Wide'}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] text-gray-500 max-w-[160px]">
                        <span className="line-clamp-2">{fu.reason || '—'}</span>
                      </td>
                      <td className="p-3 text-[10px] text-gray-600 font-medium">{fu.frozen_by_name}</td>
                      <td className="p-3 text-[10px] text-gray-400 font-mono whitespace-nowrap">
                        {fu.created_at.slice(0, 10)}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <button
                          onClick={() => handleUnfreeze(fu)}
                          disabled={unfreezingId === fu.user_id}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 ml-auto"
                        >
                          <ShieldCheck size={11} /> Unsuspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
