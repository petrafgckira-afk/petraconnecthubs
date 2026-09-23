import React, { useState, useEffect, useCallback } from 'react';
import { HubType, HubResource, HubAnnouncement } from '../types';
import { Download, Globe, FileText, Link as LinkIcon, Plus, Users, BookOpen, Send, Sparkles, Check, UserPlus, UserMinus, X } from 'lucide-react';
import { fetchMembers } from '../services/api';

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
}

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
}: MyHubPageProps) {

  const [activeTab, setActiveTab]       = useState<'members' | 'resources'>('members');
  const [allMembers, setAllMembers]     = useState<ApiHubMember[]>([]);
  const [hoverBtnId, setHoverBtnId]     = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const markFailed = (id: string) => setFailedAvatars(prev => new Set([...prev, id]));

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

  const titleName = hubDisplayName ?? `${userHub} Hub`;
  const descName  = isAllHubs ? null : (hubDisplayName?.replace(' Hub', '') ?? userHub);

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in">
      
      {/* 1. Hub Header / Showcase Banner */}
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

        {/* Members stats summary */}
        <div className="flex items-center gap-6 bg-navy-50/50 p-4 rounded-xl border border-navy-100/50 shrink-0">
          <div className="text-center font-sans">
            <span className="block text-xl font-bold text-navy-950 leading-none">{hubMembers.length}</span>
            <span className="text-[10px] text-gray-500 block">Hub Peers</span>
          </div>
          <div className="h-8 border-r border-navy-200"></div>
          <div className="text-center font-sans">
            <span className="block text-xl font-bold text-navy-950 leading-none">{hubResources.length}</span>
            <span className="text-[10px] text-gray-500 block font-sans">Resources</span>
          </div>
        </div>
      </div>

      {/* 2. Announcements Ticker inside Hub */}
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

      {/* 3. Navigation between Peers or Resources */}
      <div className="flex border-b border-gray-200 gap-1 select-none">
        <button
          onClick={() => setActiveTab('members')}
          className={`py-3.5 px-6 font-sans text-xs font-bold border-b-2 transition duration-150 flex items-center gap-2 cursor-pointer ${
            activeTab === 'members'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-gray-500 hover:text-navy-900 hover:border-navy-200'
          }`}
        >
          <Users size={14} />
          Hub Peers Directory ({hubMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`py-3.5 px-6 font-sans text-xs font-bold border-b-2 transition duration-150 flex items-center gap-2 cursor-pointer ${
            activeTab === 'resources'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-gray-500 hover:text-navy-900 hover:border-navy-200'
          }`}
        >
          <BookOpen size={14} />
          Knowledge & Mentorship Files ({hubResources.length})
        </button>
      </div>

      {/* 4. Tab Content: MEMBERS GRID */}
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
                <div
                  key={member.id}
                  className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs hover:shadow-md hover:border-brand-gold/30 transition-all duration-200 flex flex-col justify-between"
                >
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
                    <button
                      onClick={() => onSendMessage(member.id)}
                      className="w-full text-navy-900 border border-navy-900 hover:bg-navy-900 hover:text-white transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Send size={11} /> Chat
                    </button>
                    {connStatus === 'connected' ? (
                      <button
                        onClick={() => onRemoveConnection(member.id)}
                        onMouseEnter={() => setHoverBtnId(member.id)}
                        onMouseLeave={() => setHoverBtnId(null)}
                        className={`w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border ${
                          hoverBtnId === member.id
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {hoverBtnId === member.id
                          ? <><UserMinus size={11} /> Disconnect</>
                          : <><Check size={11} /> Connected</>}
                      </button>
                    ) : connStatus === 'pending_sent' ? (
                      <button
                        onClick={() => onRemoveConnection(member.id)}
                        onMouseEnter={() => setHoverBtnId(member.id)}
                        onMouseLeave={() => setHoverBtnId(null)}
                        className={`w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border ${
                          hoverBtnId === member.id
                            ? 'bg-gray-50 text-gray-600 border-gray-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {hoverBtnId === member.id
                          ? <><X size={11} /> Cancel</>
                          : <>Pending</>}
                      </button>
                    ) : (
                      <button
                        onClick={() => onConnectMember(member.id)}
                        className="w-full transition py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer bg-navy-900 text-white hover:bg-navy-800"
                      >
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

      {/* 5. Tab Content: RESOURCES LIST */}
      {activeTab === 'resources' && (
        <section className="bg-white border rounded-xl overflow-hidden shadow-xs animate-fade-in border-slate-100">
          <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="font-bold text-sm text-navy-950">Approved Educational Assets</h2>
              <p className="text-[11px] text-gray-500">Curated guidelines, schemas, and templates approved by Hub organizers.</p>
            </div>
            
            {userRole === 'hub_leader' && (
              <button 
                onClick={() => setView('leader-panel')}
                className="inline-flex items-center gap-1 btn-gold shadow-xs py-1.5 px-3 rounded-lg text-xs font-bold font-sans cursor-pointer bg-brand-gold text-navy-950 hover:bg-amber-400 transition"
              >
                <Plus size={12} /> Share Resource
              </button>
            )}
          </div>

          <div className="p-2 space-y-2">
            {hubResources.length === 0 ? (
              <div className="py-12 text-center text-gray-400 italic text-sm">
                No files uploaded to the {titleName} Resource Center yet.
              </div>
            ) : (
              hubResources.map((res) => (
                <div 
                  key={res.id}
                  className="p-4 hover:bg-navy-50/50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition duration-150 border-b border-dashed border-slate-100 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-navy-950 text-brand-gold rounded-lg flex items-center justify-center shrink-0 border border-brand-gold/30">
                      {res.fileType === 'pdf' ? <FileText size={18} /> : res.fileType === 'link' ? <LinkIcon size={18} /> : <Globe size={18} />}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-navy-950">{res.title}</h4>
                      <p className="text-gray-500 text-[11px] leading-tight max-w-xl text-justify">{res.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono pt-1">
                        <span>By {res.uploadedBy}</span>
                        <span>•</span>
                        <span>{res.date}</span>
                        {res.fileSize && (
                          <>
                            <span>•</span>
                            <span>{res.fileSize}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-navy-700 font-medium">{res.downloadCount} downloads</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDownloadResource(res.id)}
                    className="inline-flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-white border border-navy-950 text-[11px] font-bold py-1.5 px-3 rounded-lg transition shadow-xs self-start sm:self-center cursor-pointer"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

    </div>
  );
}
