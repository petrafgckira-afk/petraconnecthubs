import React from 'react';
import { PetraNotification } from '../types';
import { 
  Bell, 
  MessageSquare, 
  UserPlus, 
  Calendar, 
  CheckCircle, 
  Megaphone, 
  Sparkles,
  Trash2,
  CheckCheck,
  Info
} from 'lucide-react';

interface NotificationsPageProps {
  notifications: PetraNotification[];
  onMarkRead: (id: string) => void;
  onClearNotification: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationsPage({
  notifications,
  onMarkRead,
  onClearNotification,
  onMarkAllRead
}: NotificationsPageProps) {

  const getIcon = (type: string) => {
    switch(type) {
      case 'message':
        return { comp: MessageSquare, color: 'text-blue-600 bg-blue-50 border-blue-100' };
      case 'connection':
        return { comp: UserPlus, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
      case 'event':
        return { comp: Calendar, color: 'text-amber-600 bg-amber-50 border-amber-100' };
      case 'approval':
        return { comp: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      case 'announcement':
        return { comp: Megaphone, color: 'text-purple-600 bg-purple-50 border-purple-100' };
      default:
        return { comp: Bell, color: 'text-gray-600 bg-gray-50 border-gray-100' };
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in font-sans">
      
      {/* Notifications Header Info */}
      <div className="bg-white rounded-2xl border border-navy-100 p-6 md:p-8 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-navy-950">
            Inbox Alert Notifications
          </h1>
          <p className="text-gray-500 text-sm">
            Keep updated with latest connections, approvals, event rosters, and announcements.
          </p>
        </div>

        {notifications.some(n => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs py-2 px-4 rounded-lg transition shrink-0 shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck size={14} /> Mark All as Read
          </button>
        )}
      </div>

      {/* Main notifications list card */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-xs border-slate-100">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Bell size={20} />
            </div>
            <h3 className="font-bold text-sm text-navy-950">All caught up!</h3>
            <p className="text-xs max-w-xs mx-auto">No notifications currently active. When members connect or leaders post events, you'll see alerts here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((item) => {
              const { comp: IconComponent, color: colorClasses } = getIcon(item.type);

              return (
                <div 
                  key={item.id}
                  onClick={() => onMarkRead(item.id)}
                  className={`p-4 md:p-5 flex items-start justify-between gap-4 transition duration-150 cursor-pointer ${
                    item.read ? 'bg-white opacity-85 hover:bg-slate-50/50' : 'bg-brand-gold-light/20 hover:bg-brand-gold-light/40 border-l-4 border-brand-gold'
                  }`}
                >
                  <div className="flex gap-3.5 items-start">
                    {/* Visual icon representation */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${colorClasses}`}>
                      <IconComponent size={16} />
                    </div>
                    
                    {/* Content Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-xs text-navy-950 font-bold ${item.read ? 'font-medium' : 'font-bold'}`}>
                          {item.title}
                        </h4>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-brand-gold block shrink-0"></span>
                        )}
                      </div>
                      <p className="text-gray-500 text-[11px] leading-relaxed max-w-xl text-justify">
                        {item.description}
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono block">{item.time}</span>
                    </div>
                  </div>

                  {/* Actions (trash button) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Stop trigger page click
                      onClearNotification(item.id);
                    }}
                    className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded text-gray-405 transition shrink-0 cursor-pointer"
                    title="Dismiss alert"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 bg-navy-50/70 border rounded-xl flex items-start gap-2 max-w-2xl text-[11px] text-gray-500 border-navy-150">
        <Info size={14} className="text-navy-900 shrink-0 mt-0.5" />
        <span>
          If you opt to receive mobile push SMS messages or Sunday bulletin briefings, you can toggle alerts directly in your church user profiles.
        </span>
      </div>

    </div>
  );
}
