import React, { useState, useEffect, useCallback } from 'react';
import { HubType, HubResource, HubAnnouncement } from '../types';
import {
  Download, Globe, FileText, Link as LinkIcon, Plus, Users, BookOpen,
  Send, Sparkles, Check, UserPlus, UserMinus, X, Video, Music, Image,
  Upload, ChevronDown,
} from 'lucide-react';
import { fetchMembers, createResource } from '../services/api';

interface ApiHubMember {
  id: string;
  full_name: string;
  email: string;
  profession: string;
  bio: string | null;
  hub_name: string | null;
  profile_image: string | null;
}

interface MyHubPageProps {
  userHub: HubType;
  resources: HubResource[];
  announcements: HubAnnouncement[];
  connections: Record<string, 'connected' | 'pending_sent' | 'not_connected'>;
  onDownloadResource: (id: string) => void;
  onSendMessage: (userId: string) => void;
  onConnectMember: (id: string) => void;
  onRemoveConnection: (id: string) => void;
  userRole: string;
  setView: (view: string) => void;
  hubDisplayName?: string;
  isAllHubs?: boolean;
  onShareResource?: () => void;
  initialTab?: 'members' | 'resources';
}

type ResourceFileType = HubResource['fileType'];

const FILE_TYPE_META: Record<ResourceFileType, { label: string; icon: React.ReactNode; bg: string; text: string; border: string; tab: 'docs' | 'media' }> = {
  pdf:   { label: 'PDF',    icon: <FileText size={18} />,  bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100',    tab: 'docs' },
  doc:   { label: 'DOC',    icon: <FileText size={18} />,  bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100',   tab: 'docs' },
  epub:  { label: 'EPUB',   icon: <BookOpen size={18} />,  bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', tab: 'docs' },
  link:  { label: 'LINK',   icon: <LinkIcon size={18} />,  bg: 'bg-navy-950',  text: 'text-brand-gold', border: 'border-brand-gold/30', tab: 'docs' },
  video: { label: 'VIDEO',  icon: <Video size={18} />,     bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100',  tab: 'media' },
  audio: { label: 'AUDIO',  icon: <Music size={18} />,     bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100',  tab: 'media' },
  image: { label: 'IMAGE',  icon: <Image size={18} />,     bg: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-100',   tab: 'media' },
};

const DOC_TYPES: ResourceFileType[] = ['pdf', 'doc', 'epub', 'link'];
const MEDIA_TYPES: ResourceFileType[] = ['video', 'audio', 'image'];

export default function MyHubPage({
  userHub,
  resources,
  announcements,
  connections,
  onDownloadResource,
  onSendMessage,
  onConnectMember,
  onRemoveConnection,
  userRole,
  setView,
  hubDisplayName,
  isAllHubs = false,
  onShareResource,
  initialTab = 'members',
}: MyHubPageProps) {

  const [activeTab, setActiveTab]           = useState<'members' | 'resources'>(initialTab);
  const [resourceSubTab, setResourceSubTab] = useState<'docs' | 'media'>('docs');

  // Sync if parent navigates us here with a specific tab (e.g. after upload)
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  const [allMembers, setAllMembers]         = useState<ApiHubMember[]>([]);
  const [hoverBtnId, setHoverBtnId]         = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars]   = useState<Set<string>>(new Set());
  const markFailed = (id: string) => setFailedAvatars(prev => new Set([...prev, id]));

  // Member resource submission form
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [subTitle, setSubTitle]             = useState('');
  const [subDesc, setSubDesc]               = useState('');
  const [subType, setSubType]               = useState<ResourceFileType>('pdf');
  const [subSubmitting, setSubSubmitting]   = useState(false);
  const [subSuccess, setSubSuccess]         = useState(false);
  const [subError, setSubError]             = useState('');

  const loadMembers = useCallback(() => {
    fetchMembers()
      .then(data => setAllMembers(data.members || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => {
    const id = setInterval(() => loadMembers(), 30_000);
    return () => clearInterval(id);
  }, [loadMembers]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const hubMembers       = isAllHubs ? allMembers : allMembers.filter(m => m.hub_name === `${userHub} Hub`);
  const hubResources     = isAllHubs ? resources  : resources.filter(r => r.hubId === userHub);
  const hubAnnouncements = isAllHubs ? announcements : announcements.filter(a => a.hubId === userHub);

  const docsResources  = hubResources.filter(r => DOC_TYPES.includes(r.fileType));
  const mediaResources = hubResources.filter(r => MEDIA_TYPES.includes(r.fileType));
  const activeResources = resourceSubTab === 'docs' ? docsResources : mediaResources;

  const titleName = hubDisplayName ?? `${userHub} Hub`;
  const descName  = isAllHubs ? null : (hubDisplayName?.replace(' Hub', '') ?? userHub);

  const handleSubmitResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTitle.trim()) return;
    setSubSubmitting(true);
    setSubError('');
    try {
      await createResource({
        hub_type:     userHub,
        title:        subTitle,
        description:  subDesc,
        file_type:    subType,
        download_url: '#',
      });
      setSubSuccess(true);
      setSubTitle(''); setSubDesc(''); setSubType('pdf');
      setTimeout(() => { setSubSuccess(false); setShowSubmitForm(false); }, 4000);
    } catch {
      setSubError('Submission failed. Please check your connection and try again.');
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in">

      {/* Hub Header */}
      <div className="bg-white rounded-2xl border border-navy-100 p-6 md:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-brand-gold-light border border-brand-gold text-brand-gold py-1 px-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider block w-fit">
              Vocation Circle
            </span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-navy-950">
            Welcome to the <span className="text-brand-gold">{titleName}</span>
          </h1>
          <p className="text-gray-500 text-sm max-w-xl">
            {isAllHubs
              ? 'A system-wide view across all professional hubs. Monitor members, resources, and announcements from every vocation circle.'
              : `A high-standard collaboration suite. Connect with certified ${descName} masterminds under guided Christian mentorship and strategic asset-sharing.`
            }
          </p>
        </div>
        <div className="flex items-center gap-6 bg-navy-50/50 p-4 rounded-xl border border-navy-100/50 shrink-0">
          <div className="text-center font-sans">
            <span className="block text-xl font-bold text-navy-950 leading-none">{hubMembers.length}</span>
            <span className="text-[10px] text-gray-500 block">Hub Peers</span>
          </div>
          <div className="h-8 border-r border-navy-200" />
          <div className="text-center font-sans">
            <span className="block text-xl font-bold text-navy-950 leading-none">{hubResources.length}</span>
            <span className="text-[10px] text-gray-500 block font-sans">Resources</span>
          </div>
        </div>
      </div>

      {/* Announcements ticker */}
      {hubAnnouncements.length > 0 && (
        <div className="bg-amber-50/30 border border-amber-200/50 p-4 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-gold-light text-brand-gold border border-brand-gold/30 shrink-0 flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-amber-950 uppercase tracking-widest block font-sans">Latest Guild Update</span>
            <h4 className="text-xs font-bold text-navy-950 leading-tight">{hubAnnouncements[0].title}</h4>
            <p className="text-gray-600 text-xs line-clamp-2 leading-relaxed">{hubAnnouncements[0].content}</p>
          </div>
        </div>
      )}

      {/* Main tabs */}
      <div className="flex border-b border-gray-200 gap-1 select-none">
        <button
          onClick={() => setActiveTab('members')}
          className={`py-3.5 px-6 font-sans text-xs font-bold border-b-2 transition duration-150 flex items-center gap-2 cursor-pointer ${
            activeTab === 'members' ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-500 hover:text-navy-900 hover:border-navy-200'
          }`}
        >
          <Users size={14} /> Hub Peers Directory ({hubMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`py-3.5 px-6 font-sans text-xs font-bold border-b-2 transition duration-150 flex items-center gap-2 cursor-pointer ${
            activeTab === 'resources' ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-500 hover:text-navy-900 hover:border-navy-200'
          }`}
        >
          <BookOpen size={14} /> Knowledge & Mentorship Files ({hubResources.length})
        </button>
      </div>

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {hubMembers.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-gray-600 font-medium italic col-span-full">
              No approved members in your specific Hub directory yet.
            </div>
          ) : (
            hubMembers.map((member) => {
              const connStatus = connections[member.id] || 'not_connected';
              return (
                <div key={member.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs hover:shadow-md hover:border-brand-gold/30 transition-all duration-200 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex gap-3 justify-start items-start">
                      <div className="w-11 h-11 rounded-full bg-navy-950 font-serif border-2 border-brand-gold text-white font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden relative">
                        <span className="absolute inset-0 flex items-center justify-center">{getInitials(member.full_name)}</span>
                        {member.profile_image && !failedAvatars.has(member.id) && (
                          <img src={member.profile_image} alt={member.full_name} className="absolute inset-0 w-full h-full object-cover" onError={() => markFailed(member.id)} />
                        )}
                      </div>
                      <div className="space-y-0.5 truncate">
                        <h3 className="font-bold text-sm text-navy-950 block truncate leading-tight">{member.full_name}</h3>
                        <span className="text-[10px] text-amber-800 font-bold tracking-wider font-mono uppercase block -mt-0.5 truncate bg-brand-gold-light border border-brand-gold/10 px-1.5 py-0.2 w-fit rounded">
                          {member.profession}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs leading-relaxed line-clamp-3 text-justify pl-1 border-l-2 border-navy-100">
                      {member.bio || 'Christian Professional.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 mt-5">
                    <button onClick={() => onSendMessage(member.id)} className="w-full text-navy-900 border border-navy-900 hover:bg-navy-900 hover:text-white transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                      <Send size={11} /> Chat
                    </button>
                    {connStatus === 'connected' ? (
                      <button
                        onClick={() => onRemoveConnection(member.id)}
                        onMouseEnter={() => setHoverBtnId(member.id)}
                        onMouseLeave={() => setHoverBtnId(null)}
                        className={`w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border ${hoverBtnId === member.id ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                      >
                        {hoverBtnId === member.id ? <><UserMinus size={11} /> Disconnect</> : <><Check size={11} /> Connected</>}
                      </button>
                    ) : connStatus === 'pending_sent' ? (
                      <button
                        onClick={() => onRemoveConnection(member.id)}
                        onMouseEnter={() => setHoverBtnId(member.id)}
                        onMouseLeave={() => setHoverBtnId(null)}
                        className={`w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border ${hoverBtnId === member.id ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                      >
                        {hoverBtnId === member.id ? <><X size={11} /> Cancel</> : <>Pending</>}
                      </button>
                    ) : (
                      <button onClick={() => onConnectMember(member.id)} className="w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer bg-navy-900 text-white hover:bg-navy-800">
                        <UserPlus size={11} /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* RESOURCES TAB */}
      {activeTab === 'resources' && (
        <section className="space-y-4 animate-fade-in">

          {/* Header row */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-gray-50/50 flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-sm text-navy-950">Approved Educational Assets</h2>
                <p className="text-[11px] text-gray-500">Curated guidelines, schemas, and templates approved by Hub organizers.</p>
              </div>
              <div className="flex gap-2">
                {(userRole === 'hub_leader' || userRole === 'admin') && (
                  <button onClick={onShareResource} className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-navy-900 text-white hover:bg-navy-800 transition cursor-pointer">
                    <Upload size={12} /> Share Resource
                  </button>
                )}
                {userRole === 'member' && !showSubmitForm && (
                  <button onClick={() => setShowSubmitForm(true)} className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-navy-900 text-white hover:bg-navy-800 transition cursor-pointer">
                    <Upload size={12} /> Submit Resource
                  </button>
                )}
              </div>
            </div>

            {/* Resource submission form — members only */}
            {userRole === 'member' && showSubmitForm && (
              <div className="p-5 border-b border-slate-100 bg-navy-50/30 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xs text-navy-950">
                    {userRole === 'member' ? 'Submit a Resource for Review' : 'Share a Resource'}
                  </h3>
                  <button onClick={() => setShowSubmitForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14} /></button>
                </div>
                {subSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-bold text-center mb-4">
                    {userRole === 'member'
                      ? 'Submitted! Your hub leader will review and approve it shortly.'
                      : 'Resource shared successfully and is now live in the hub.'}
                  </div>
                )}
                {subError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs mb-4">{subError}</div>
                )}
                {!subSuccess && (
                  <form onSubmit={handleSubmitResource} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Title *</label>
                        <input value={subTitle} onChange={e => setSubTitle(e.target.value)} required placeholder="e.g. Finance Budgeting Template 2026" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-none focus:border-brand-gold transition" />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Description</label>
                        <textarea value={subDesc} onChange={e => setSubDesc(e.target.value)} rows={2} placeholder="Brief description of what this resource contains..." className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-navy-950 focus:outline-none focus:border-brand-gold transition" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Type</label>
                        <select value={subType} onChange={e => setSubType(e.target.value as ResourceFileType)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-navy-900 focus:outline-none">
                          <option value="pdf">PDF Document</option>
                          <option value="doc">Word / Excel</option>
                          <option value="epub">eBook / EPUB</option>
                          <option value="link">Web Link</option>
                          <option value="video">Video</option>
                          <option value="audio">Audio / Podcast</option>
                          <option value="image">Image / Infographic</option>
                        </select>
                      </div>
                      {subType !== 'link' && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">File Size</span>
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-gray-400 italic select-none">
                            Determined upon download
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={subSubmitting} className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs py-2 px-4 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                        <Upload size={12} /> {subSubmitting ? 'Submitting…' : userRole === 'member' ? 'Submit for Review' : 'Share Resource'}
                      </button>
                      <button type="button" onClick={() => setShowSubmitForm(false)} className="border border-slate-200 text-gray-500 font-medium text-xs py-2 px-4 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Resource sub-tabs */}
            <div className="flex border-b border-slate-100 bg-white">
              <button
                onClick={() => setResourceSubTab('docs')}
                className={`py-3 px-5 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${resourceSubTab === 'docs' ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-400 hover:text-navy-900'}`}
              >
                <FileText size={13} /> Documents &amp; Links ({docsResources.length})
              </button>
              <button
                onClick={() => setResourceSubTab('media')}
                className={`py-3 px-5 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${resourceSubTab === 'media' ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-400 hover:text-navy-900'}`}
              >
                <Video size={13} /> Media ({mediaResources.length})
              </button>
            </div>

            {/* Resource list */}
            <div className="p-2 space-y-1">
              {activeResources.length === 0 ? (
                <div className="py-10 text-center text-gray-400 italic text-sm">
                  No {resourceSubTab === 'docs' ? 'documents or links' : 'media files'} uploaded to the {titleName} Resource Center yet.
                </div>
              ) : (
                activeResources.map((res) => {
                  const meta = FILE_TYPE_META[res.fileType] ?? FILE_TYPE_META.link;
                  return (
                    <div key={res.id} className="p-4 hover:bg-navy-50/40 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition duration-150 border-b border-dashed border-slate-100 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {meta.icon}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-navy-950">{res.title}</h4>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>{meta.label}</span>
                          </div>
                          <p className="text-gray-500 text-[11px] leading-tight max-w-xl text-justify">{res.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono pt-1">
                            <span>By {res.uploadedBy}</span>
                            <span>•</span>
                            <span>{res.date}</span>
                            {res.fileSize && <><span>•</span><span>{res.fileSize}</span></>}
                            <span>•</span>
                            <span className="text-navy-700 font-medium">{res.downloadCount} downloads</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDownloadResource(res.id)}
                        className="inline-flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-white border border-navy-950 text-[11px] font-bold py-1.5 px-3 rounded-lg transition shadow-xs self-start sm:self-center cursor-pointer"
                      >
                        <Download size={12} /> {res.fileType === 'link' ? 'Open' : 'Download'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
