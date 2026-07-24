import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Camera, Edit3, Check, X, MapPin, Briefcase, Calendar,
  Building2, User, Mail, Phone, Loader2, Eye, Pencil,
} from 'lucide-react';
import { fetchOwnProfile, updateProfile, uploadProfilePhoto } from '../services/api';

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_image: string | null;
  gender: string | null;
  location: string | null;
  profession: string | null;
  bio: string | null;
  role: string;
  years_of_experience: string | null;
  created_at: string;
  hub_status: string | null;
  hub_name: string | null;
}

interface Props {
  onProfileUpdated: (updates: { name: string; profileImage: string | null }) => void;
}

export default function ProfilePage({ onProfileUpdated }: Props) {
  const [profile, setProfile]       = useState<ProfileData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [popup, setPopup]           = useState(false);
  const [photoMenu, setPhotoMenu]   = useState(false);
  const [viewPhoto, setViewPhoto]   = useState(false);
  const [menuPos, setMenuPos]       = useState<{ top: number; left: number } | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoZoom,  setPhotoZoom]  = useState(1);
  const [photoPan,   setPhotoPan]   = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [form, setForm] = useState({
    full_name:  '',
    profession: '',
    bio:        '',
    location:   '',
  });

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const menuRef        = useRef<HTMLDivElement>(null);
  const dropdownRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOwnProfile()
      .then(data => {
        setProfile(data.user);
        setForm({
          full_name:  data.user.full_name  || '',
          profession: data.user.profession || '',
          bio:        data.user.bio        || '',
          location:   data.user.location   || '',
        });
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!photoMenu) return;
    const handler = (e: MouseEvent) => {
      const inAvatar   = menuRef.current?.contains(e.target as Node);
      const inDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!inAvatar && !inDropdown) setPhotoMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [photoMenu]);

  const startEdit = () => {
    if (!profile) return;
    setForm({
      full_name:  profile.full_name  || '',
      profession: profile.profession || '',
      bio:        profile.bio        || '',
      location:   profile.location   || '',
    });
    setEditing(true);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
  };

  const saveEdit = async () => {
    if (!form.full_name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const data = await updateProfile(form);
      setProfile(prev => prev ? { ...prev, ...data.user } : data.user);
      onProfileUpdated({ name: data.user.full_name, profileImage: data.user.profile_image });
      setEditing(false);
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoClick = () => {
    if (photoMenu) { setPhotoMenu(false); return; }
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left });
    }
    setPhotoMenu(true);
  };
  const handleEditPhoto  = () => { setPhotoMenu(false); fileInputRef.current?.click(); };
  const handleViewPhoto  = () => {
    setPhotoMenu(false);
    setViewPhoto(true);
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
  };
  const handleClosePhoto = () => { setViewPhoto(false); setPhotoZoom(1); setPhotoPan({ x: 0, y: 0 }); setIsDragging(false); };

  const handlePhotoWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.ctrlKey
      ? Math.max(0.82, Math.min(1.18, 1 - e.deltaY * 0.018))
      : Math.max(0.92, Math.min(1.08, 1 - e.deltaY * 0.004));
    const next = Math.min(5, Math.max(1, photoZoom * factor));
    setPhotoZoom(next);
    if (next <= 1) setPhotoPan({ x: 0, y: 0 });
  };

  const handlePhotoDblClick = () => {
    if (photoZoom > 1) { setPhotoZoom(1); setPhotoPan({ x: 0, y: 0 }); }
    else setPhotoZoom(2.5);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (photoZoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: photoPan.x, panY: photoPan.y };
      e.preventDefault();
    }
  };
  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPhotoPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const handleDragEnd = () => setIsDragging(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const validType = allowed.includes(file.type);
    const validSize = file.size <= 5 * 1024 * 1024;

    if (!validType || !validSize) {
      setPopup(true);
      e.target.value = '';
      return;
    }

    setPhotoUploading(true);
    setError('');
    try {
      const url = await uploadProfilePhoto(file);
      setProfile(prev => prev ? { ...prev, profile_image: url } : prev);
      setPhotoFailed(false);
      onProfileUpdated({ name: profile?.full_name || '', profileImage: url });
      setSuccess('Photo updated.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const roleBadge = (role: string) => {
    if (role === 'admin')      return { label: 'Platform Admin', cls: 'bg-rose-900/40 text-rose-300 border-rose-800' };
    if (role === 'hub_leader') return { label: 'Hub Leader',     cls: 'bg-amber-900/40 text-amber-300 border-amber-800' };
    return                            { label: 'Member',         cls: 'bg-navy-800/60 text-slate-300 border-navy-700' };
  };

  const badge = roleBadge(profile?.role || 'member');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-red-400">{error || 'Profile not found.'}</div>
    );
  }

  const memberSince = profile.created_at ? profile.created_at.substring(0, 10) : '—';

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in max-w-3xl mx-auto">

      {/* ── Toast messages ── */}
      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check size={13} /> {success}
        </div>
      )}
      {error && (
        <div className="bg-rose-900/40 border border-rose-700 text-rose-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <X size={13} /> {error}
        </div>
      )}

      {/* ── Profile hero card ── */}
      <div className="bg-navy-950/60 backdrop-blur-md border border-navy-800 rounded-2xl overflow-hidden shadow-lg">

        {/* Gold banner strip */}
        <div className="h-2 bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold/60" />

        <div className="p-6">
          <div className="flex items-start gap-5">

            {/* Avatar with menu */}
            <div ref={menuRef} className="relative shrink-0">
              <div
                onClick={handlePhotoClick}
                className="w-20 h-20 rounded-full overflow-hidden cursor-pointer border-2 border-brand-gold/60 shadow-md relative group"
              >
                {profile.profile_image && !photoFailed ? (
                  <img
                    src={profile.profile_image}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                    onError={() => setPhotoFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-navy-900 border border-brand-gold/30 text-brand-gold font-bold font-serif text-2xl flex items-center justify-center">
                    {getInitials(profile.full_name)}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  {photoUploading
                    ? <Loader2 size={16} className="animate-spin text-white" />
                    : <Camera size={16} className="text-white" />}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />

              {/* Small camera badge */}
              <button
                onClick={handlePhotoClick}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-gold rounded-full flex items-center justify-center shadow border-2 border-navy-950"
                title="Photo options"
              >
                <Camera size={10} className="text-navy-950" />
              </button>

            </div>

            {/* Name + role + hub */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="bg-navy-900 border border-navy-700 text-white font-bold text-xl rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-brand-gold mb-2"
                  placeholder="Full name"
                />
              ) : (
                <h1 className="font-serif text-xl font-bold text-white leading-tight truncate">
                  {profile.full_name}
                </h1>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.cls}`}>
                  {badge.label}
                </span>
                {profile.hub_name && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-navy-800/60 text-slate-300 border-navy-700">
                    {profile.hub_name}
                  </span>
                )}
                {profile.hub_status && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    profile.hub_status === 'approved'
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800'
                      : profile.hub_status === 'pending'
                      ? 'bg-amber-900/40 text-amber-400 border-amber-800'
                      : 'bg-rose-900/40 text-rose-400 border-rose-800'
                  }`}>
                    {profile.hub_status}
                  </span>
                )}
              </div>
            </div>

            {/* Edit / Save / Cancel */}
            <div className="shrink-0 flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={cancelEdit}
                    className="p-2 rounded-lg bg-navy-800 border border-navy-700 text-gray-400 hover:text-white transition"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold text-navy-950 text-xs font-bold disabled:opacity-60 transition"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-700 text-gray-300 hover:text-white text-xs font-medium transition"
                >
                  <Edit3 size={12} /> Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4">
            {editing ? (
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="Write a short bio…"
                className="w-full bg-navy-900 border border-navy-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-gold resize-none"
              />
            ) : (
              <p className="text-sm text-gray-300 leading-relaxed">
                {profile.bio || <span className="text-gray-500 italic">No bio yet. Click Edit Profile to add one.</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Details grid ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Contact & Identity */}
        <div className="bg-navy-950/60 backdrop-blur-md border border-navy-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Contact &amp; Identity</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <Mail size={13} className="text-brand-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Email</div>
                <div className="text-sm text-gray-200 truncate">{profile.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <Phone size={13} className="text-brand-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Phone</div>
                <div className="text-sm text-gray-200">{profile.phone_number || '—'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <MapPin size={13} className="text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Location</div>
                {editing ? (
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="City, Country"
                    className="w-full bg-navy-900 border border-navy-700 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-brand-gold"
                  />
                ) : (
                  <div className="text-sm text-gray-200">{profile.location || '—'}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <Calendar size={13} className="text-brand-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Member Since</div>
                <div className="text-sm text-gray-200">{memberSince}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Info */}
        <div className="bg-navy-950/60 backdrop-blur-md border border-navy-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Professional Info</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <Briefcase size={13} className="text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Profession / Vocation</div>
                {editing ? (
                  <input
                    value={form.profession}
                    onChange={e => setForm(f => ({ ...f, profession: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                    className="w-full bg-navy-900 border border-navy-700 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-brand-gold"
                  />
                ) : (
                  <div className="text-sm text-gray-200">{profile.profession || '—'}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <Building2 size={13} className="text-brand-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Hub</div>
                <div className="text-sm text-gray-200">
                  {profile.hub_name || 'No hub assigned'}
                  {profile.hub_status && profile.hub_name && (
                    <span className="ml-2 text-[9.5px] text-gray-500">({profile.hub_status})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                <User size={13} className="text-brand-gold" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Platform Role</div>
                <div className="text-sm text-gray-200 capitalize">
                  {profile.role === 'hub_leader' ? 'Hub Leader' : profile.role}
                </div>
              </div>
            </div>

            {profile.years_of_experience && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                  <Briefcase size={13} className="text-brand-gold" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9.5px] text-gray-500 uppercase tracking-wider">Experience</div>
                  <div className="text-sm text-gray-200">{profile.years_of_experience} yrs</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo upload hint ── */}
      <p className="text-center text-[10.5px] text-gray-600">
        Click your profile photo to view or change it · JPEG, PNG or WebP · Max 5 MB
      </p>

      {/* ── Photo options menu — portaled to body to escape backdrop-filter containing block ── */}
      {photoMenu && menuPos && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl overflow-hidden min-w-[152px]"
        >
          <button
            onClick={handleViewPhoto}
            disabled={!profile.profile_image}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-gray-200 hover:bg-navy-800 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye size={13} className="text-brand-gold shrink-0" />
            View photo
          </button>
          <div className="border-t border-navy-800" />
          <button
            onClick={handleEditPhoto}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-gray-200 hover:bg-navy-800 hover:text-white transition"
          >
            <Pencil size={13} className="text-brand-gold shrink-0" />
            Edit photo
          </button>
        </div>,
        document.body
      )}

      {/* ── Full-size photo viewer ── */}
      {viewPhoto && profile.profile_image && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* Backdrop tap-to-close */}
          <div className="absolute inset-0" onClick={handleClosePhoto} />

          {/* Close button */}
          <button
            onClick={handleClosePhoto}
            className="absolute top-4 right-4 z-20 w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full flex items-center justify-center text-white transition"
          >
            <X size={16} />
          </button>

          {/* Zoom hint */}
          <p className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-xs text-white/35 pointer-events-none select-none">
            Scroll · Pinch · Double-click to zoom
          </p>

          {/* Photo */}
          <div
            className="relative z-10"
            onWheel={handlePhotoWheel}
            onDoubleClick={handlePhotoDblClick}
            onMouseDown={handleDragStart}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `scale(${photoZoom}) translate(${photoPan.x / photoZoom}px, ${photoPan.y / photoZoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease',
              cursor: photoZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              willChange: 'transform',
            }}
          >
            <img
              src={profile.profile_image}
              alt={profile.full_name}
              draggable={false}
              className="rounded-full object-cover border-4 border-brand-gold shadow-2xl pointer-events-none"
              style={{ width: 'min(70vmin, 500px)', height: 'min(70vmin, 500px)' }}
            />
          </div>

          {/* Name + zoom level */}
          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
            <p className="text-white font-bold text-base tracking-wide">{profile.full_name}</p>
            {photoZoom > 1.05 && (
              <p className="text-white/40 text-xs">{Math.round(photoZoom * 10) / 10}×</p>
            )}
          </div>
        </div>
      )}

      {/* ── Invalid file popup ── */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPopup(false)}
          />

          {/* Card */}
          <div className="relative bg-navy-950 border border-rose-800/60 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            {/* Red warning icon */}
            <div className="w-14 h-14 rounded-full bg-rose-900/40 border border-rose-700 flex items-center justify-center mx-auto mb-4">
              <X size={24} className="text-rose-400" />
            </div>

            <h3 className="text-white font-bold text-base mb-2">Invalid Input</h3>

            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              Invalid input. Please pick an image file as specified below that is less than 5 MBs.
            </p>

            {/* Accepted formats list */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 mb-5 text-left space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Accepted formats</p>
              {[
                { ext: 'JPEG / JPG', desc: 'Photo or camera image' },
                { ext: 'PNG',        desc: 'Image with transparency' },
                { ext: 'WebP',       desc: 'Modern web image format' },
              ].map(f => (
                <div key={f.ext} className="flex items-center gap-2.5">
                  <span className="text-[9px] font-bold bg-navy-800 border border-navy-700 text-brand-gold px-2 py-0.5 rounded font-mono">
                    {f.ext}
                  </span>
                  <span className="text-xs text-gray-400">{f.desc}</span>
                </div>
              ))}
              <div className="border-t border-navy-700 pt-2 mt-1 flex items-center gap-2.5">
                <span className="text-[9px] font-bold bg-navy-800 border border-navy-700 text-brand-gold px-2 py-0.5 rounded font-mono">
                  MAX SIZE
                </span>
                <span className="text-xs text-gray-400">5 MB per file</span>
              </div>
            </div>

            <button
              onClick={() => setPopup(false)}
              className="w-full bg-brand-gold text-navy-950 font-bold text-sm py-2.5 rounded-xl hover:bg-amber-400 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
