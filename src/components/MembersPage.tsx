import React, { useState, useEffect, useCallback } from 'react';
import { HubType } from '../types';
import { Search, UserPlus, MessageSquare, Send, CheckCircle2, Check, UserMinus, X } from 'lucide-react';
import { fetchMembers } from '../services/api';

interface ApiMember {
  id: string;
  full_name: string;
  email: string;
  profession: string;
  bio: string | null;
  location: string | null;
  hub_name: string | null;
  profile_image: string | null;
}

interface MembersPageProps {
  onConnectMember: (id: string) => void;
  onRemoveConnection: (id: string) => void;
  onSendMessage: (userId: string) => void;
  connections: { [key: string]: 'connected' | 'pending_sent' | 'not_connected' };
}

export default function MembersPage({
  onConnectMember,
  onRemoveConnection,
  onSendMessage,
  connections
}: MembersPageProps) {

  const [members, setMembers]               = useState<ApiMember[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState<'All' | HubType>('All');
  const [hoverBtnId, setHoverBtnId]         = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars]   = useState<Set<string>>(new Set());
  const markFailed = (id: string) => setFailedAvatars(prev => new Set([...prev, id]));

  const loadMembers = useCallback(() => {
    fetchMembers()
      .then(data => setMembers(data.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    const interval = setInterval(loadMembers, 30_000);
    return () => clearInterval(interval);
  }, [loadMembers]);

  const filterPills: ('All' | HubType)[] = [
    'All', 'Business', 'Technology', 'Medical',
    'Finance', 'Education', 'Media & Creative', 'Leadership & Ministry'
  ];

  const filteredMembers = members.filter((m) => {
    const matchesHub = selectedHubFilter === 'All' || m.profession === selectedHubFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      m.full_name.toLowerCase().includes(q) ||
      (m.bio?.toLowerCase().includes(q) ?? false) ||
      (m.profession?.toLowerCase().includes(q) ?? false);
    return matchesHub && matchesSearch;
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in font-sans">
      
      {/* Search Header panel */}
      <div className="bg-white rounded-2xl border border-navy-100 p-6 md:p-8 shadow-xs space-y-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-navy-950">
            Petra Professional Directory
          </h1>
          <p className="text-gray-500 text-sm">
            Search and connect with experts across any vocational guild in our church community.
          </p>
        </div>

        {/* Search Input and Categories filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1" id="search-input-group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, profession keywords, skills (e.g. Node.js, Excel, Doctor)..."
              className="w-full bg-navy-50/50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-navy-950 focus:outline-hidden focus:border-brand-gold transition-colors duration-150"
            />
          </div>
          
          <button 
            onClick={() => { setSearchQuery(''); setSelectedHubFilter('All'); }}
            className="text-gray-500 hover:text-navy-900 text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition self-stretch shrink-0 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>

        {/* Categories filters pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 select-none">
          {filterPills.map((pill) => {
            const isActive = selectedHubFilter === pill;
            return (
              <button
                key={pill}
                onClick={() => setSelectedHubFilter(pill)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border Transition cursor-pointer ${
                  isActive
                    ? 'bg-navy-900 border-navy-950 text-white shadow-xs'
                    : 'bg-navy-50/50 border-slate-100 text-gray-500 hover:bg-slate-100'
                }`}
              >
                {pill === 'All' ? 'All Hubs' : pill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Directory Grids */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-sm">Loading directory...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white border rounded-2xl p-12 text-center col-span-full max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 bg-navy-50 rounded-full flex items-center justify-center mx-auto text-navy-900">
              <Search size={20} />
            </div>
            <h3 className="font-bold text-navy-950 text-sm">No members found matching parameters</h3>
            <p className="text-gray-500 text-xs text-justify">
              Try typing a different keyword or tapping 'All Hubs' category above.
            </p>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const connStatus = connections[member.id] || 'not_connected';
            const initials = getInitials(member.full_name);

            return (
              <div
                key={member.id}
                className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs hover:shadow-md hover:border-brand-gold/30 transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex gap-3 justify-start items-start">
                    {member.profile_image && !failedAvatars.has(member.id) ? (
                      <img
                        src={member.profile_image}
                        alt={member.full_name}
                        className="w-11 h-11 rounded-full border-2 border-brand-gold object-cover shrink-0 shadow-xs"
                        onError={() => markFailed(member.id)}
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-navy-900 font-serif border-2 border-brand-gold text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {initials}
                      </div>
                    )}
                    <div className="space-y-0.5 truncate">
                      <h3 className="font-bold text-xs text-navy-950 block truncate leading-tight">{member.full_name}</h3>
                      <span className="text-[9px] text-amber-800 font-black tracking-wider uppercase font-mono block w-fit bg-brand-gold-light border border-brand-gold/10 px-1.5 py-0.2 rounded mt-0.5">
                        {member.hub_name ?? `${member.profession} Hub`}
                      </span>
                      {member.location && (
                        <p className="text-gray-400 text-[10.5px] truncate">{member.location}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-600 text-[11px] leading-relaxed line-clamp-3 text-justify pl-1 border-l-2 border-slate-100 italic">
                    "{member.bio || 'Christian Professional.'}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 mt-5">
                  <button
                    onClick={() => onSendMessage(member.id)}
                    className="w-full text-navy-900 border border-navy-900 hover:bg-navy-900 hover:text-white transition py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MessageSquare size={12} /> Chat
                  </button>

                  {connStatus === 'connected' ? (
                    <button
                      onClick={() => onRemoveConnection(member.id)}
                      onMouseEnter={() => setHoverBtnId(member.id)}
                      onMouseLeave={() => setHoverBtnId(null)}
                      className={`w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border-2 ${
                        hoverBtnId === member.id
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-100'
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
                      className={`w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border-2 ${
                        hoverBtnId === member.id
                          ? 'bg-gray-50 text-gray-600 border-gray-200'
                          : 'bg-amber-50 text-amber-800 border-amber-100'
                      }`}
                    >
                      {hoverBtnId === member.id
                        ? <><X size={11} /> Cancel Request</>
                        : <>Sent...</>}
                    </button>
                  ) : (
                    <button
                      onClick={() => onConnectMember(member.id)}
                      className="w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer bg-navy-900 text-white hover:bg-navy-800"
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

    </div>
  );
}
