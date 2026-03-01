// client/src/pages/CalendarPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Calendar,
    CalendarDays,
    RefreshCw,
    Link2,
    Link2Off,
    MapPin,
    Clock,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Plus,
    Pencil,
    Trash2,
    X,
    FileText,
    Filter,
    ChevronDown,
} from 'lucide-react';
import {
    getGoogleCalendarStatus,
    getGoogleConnectUrl,
    disconnectGoogleCalendar,
    listUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    CalendarEvent,
} from '../services/googleCalendarApi';
import SimpleLoader from '../components/common/SimpleLoader';
import ConfirmModal from '../components/common/ConfirmModal';

// ── Types ──

export type TimeFilter =
    | '7d'
    | '30d'
    | '3m'
    | 'thisMonth'
    | 'nextMonth'
    | 'thisYear'
    | 'nextYear'
    | 'upcoming';

interface FilterOption {
    id: TimeFilter;
    label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
    { id: 'upcoming', label: 'All Upcoming' },
    { id: '7d', label: 'Next 7 Days' },
    { id: '30d', label: 'Next 30 Days' },
    { id: '3m', label: 'Next 3 Months' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'nextMonth', label: 'Next Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'nextYear', label: 'Next Year' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFilterRange(filter: TimeFilter): { timeMin: string; timeMax?: string } {
    const now = new Date();
    const timeMin = now.toISOString();

    switch (filter) {
        case '7d': {
            const end = new Date();
            end.setDate(now.getDate() + 7);
            return { timeMin, timeMax: end.toISOString() };
        }
        case '30d': {
            const end = new Date();
            end.setDate(now.getDate() + 30);
            return { timeMin, timeMax: end.toISOString() };
        }
        case '3m': {
            const end = new Date();
            end.setMonth(now.getMonth() + 3);
            return { timeMin, timeMax: end.toISOString() };
        }
        case 'thisMonth': {
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            return { timeMin, timeMax: end.toISOString() };
        }
        case 'nextMonth': {
            const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
            return { timeMin: start.toISOString(), timeMax: end.toISOString() };
        }
        case 'thisYear': {
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            return { timeMin, timeMax: end.toISOString() };
        }
        case 'nextYear': {
            const start = new Date(now.getFullYear() + 1, 0, 1);
            const end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59);
            return { timeMin: start.toISOString(), timeMax: end.toISOString() };
        }
        default:
            return { timeMin };
    }
}

function parseEventDate(start: CalendarEvent['start']): Date | null {
    const raw = start.dateTime ?? start.date;
    if (!raw) return null;
    return new Date(raw);
}

function formatTime(start: CalendarEvent['start']): string {
    if (start.date && !start.dateTime) return 'All day';
    const d = parseEventDate(start);
    if (!d) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateKey(d: Date): string {
    return d.toISOString().split('T')[0];
}

function formatDateHeading(dateKey: string): string {
    const d = new Date(dateKey + 'T12:00:00'); // noon to avoid TZ shift
    const today = new Date();
    const todayKey = formatDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrow);

    if (dateKey === todayKey) return 'Today';
    if (dateKey === tomorrowKey) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
        const d = parseEventDate(ev.start);
        if (!d) continue;
        const key = formatDateKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
    }
    return map;
}

function isToday(dateKey: string): boolean {
    return dateKey === formatDateKey(new Date());
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface EventRowProps {
    event: CalendarEvent;
    onEdit: (ev: CalendarEvent) => void;
    onDelete: (id: string) => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, onEdit, onDelete }) => (
    <div
        className="flex gap-3 py-3 px-4 rounded-xl transition-all group relative overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
    >
        {/* Time column */}
        <div
            className="flex items-center gap-1 shrink-0 w-20 text-xs font-mono"
            style={{ color: 'var(--text-muted)' }}
        >
            <Clock size={11} className="shrink-0" />
            {formatTime(event.start)}
        </div>

        {/* Event details */}
        <div className="flex-1 min-w-0 pr-16">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {event.summary}
            </p>
            {event.location && (
                <p className="flex items-center gap-1 mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    <MapPin size={10} className="shrink-0" />
                    {event.location}
                </p>
            )}
            {event.description && (
                <p className="flex items-center gap-1 mt-0.5 text-xs truncate opacity-60 italic" style={{ color: 'var(--text-muted)' }}>
                    <FileText size={10} className="shrink-0" />
                    {event.description}
                </p>
            )}
        </div>

        {/* Actions - hidden by default, shown on group hover */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={() => onEdit(event)}
                className="p-1.5 rounded-lg hover:bg-elevated transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="Edit event"
            >
                <Pencil size={14} className="hover:text-accent" />
            </button>
            <button
                onClick={() => onDelete(event.id)}
                className="p-1.5 rounded-lg hover:bg-rose-bg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="Delete event"
            >
                <Trash2 size={14} className="hover:text-rose" />
            </button>
        </div>
    </div>
);

const LoadingSkeleton: React.FC = () => (
    <div className="py-20">
        <SimpleLoader message="Loading your appointments..." />
    </div>
);

// ── Modal Sub-component ───────────────────────────────────────────────────────

interface EventModalProps {
    event?: CalendarEvent | null;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, onSave }) => {
    const [summary, setSummary] = useState(event?.summary ?? '');
    const [location, setLocation] = useState(event?.location ?? '');
    const [description, setDescription] = useState(event?.description ?? '');

    // Default dates
    const now = new Date();
    const defaultDate = (event ? parseEventDate(event.start) : now)?.toISOString().split('T')[0] ?? now.toISOString().split('T')[0];
    const defaultStart = event?.start.dateTime ?
        new Date(event.start.dateTime).toTimeString().slice(0, 5) :
        now.toTimeString().slice(0, 5);
    const defaultEnd = event?.end.dateTime ?
        new Date(event.end.dateTime).toTimeString().slice(0, 5) :
        new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

    const [date, setDate] = useState(defaultDate);
    const [startTime, setStartTime] = useState(defaultStart);
    const [endTime, setEndTime] = useState(defaultEnd);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const startISO = new Date(`${date}T${startTime}:00`).toISOString();
            const endISO = new Date(`${date}T${endTime}:00`).toISOString();

            await onSave({
                summary,
                location,
                description,
                start: { dateTime: startISO },
                end: { dateTime: endISO },
            });
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Failed to save event.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <div
                className="w-full max-w-lg card-elevated flex flex-col animate-fade-in-up"
                style={{ maxHeight: '90vh' }}
            >
                <div className="flex items-center justify-between p-5 border-b border-theme">
                    <h2 className="text-lg font-semibold font-display">
                        {event ? 'Edit Event' : 'Add New Event'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-elevated transition-colors text-muted">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {error && (
                        <div className="alert-error text-xs flex items-center gap-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="label-overline">Event Title *</label>
                        <input
                            required
                            className="input-base"
                            placeholder="What's happening?"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="label-overline">Date</label>
                            <input
                                type="date"
                                required
                                className="input-base"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <label className="label-overline">Start</label>
                                <input
                                    type="time"
                                    required
                                    className="input-base font-mono py-2"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="label-overline">End</label>
                                <input
                                    type="time"
                                    required
                                    className="input-base font-mono py-2"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="label-overline">Location</label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                className="input-base pl-9"
                                placeholder="Add location…"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="label-overline">Description</label>
                        <textarea
                            className="input-base resize-none min-h-[100px]"
                            placeholder="Add details, notes, or links…"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-primary flex-1 gap-2"
                        >
                            {saving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <CheckCircle2 size={16} />
                            )}
                            {event ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── CalendarIcon for Sidebar (exported for reuse) ─────────────────────────────
export const CalendarSvgIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const CalendarPage: React.FC = () => {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const [showEventModal, setShowEventModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        danger?: boolean;
        type?: 'confirm' | 'alert' | 'info';
    }>({
        show: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });
    const [activeFilter, setActiveFilter] = useState<TimeFilter>(() => {
        const saved = localStorage.getItem('calendar_filter');
        const validFilters: TimeFilter[] = [
            'upcoming', '7d', '30d', '3m',
            'thisMonth', 'nextMonth', 'thisYear', 'nextYear'
        ];
        return (validFilters.includes(saved as TimeFilter)) ? (saved as TimeFilter) : 'upcoming';
    });

    // Check URL params for post-OAuth redirect signals
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('googleCalendar') === 'error') {
            setError(`Google connection failed: ${params.get('reason') ?? 'unknown error'}`);
        }
        // Clean up the query string
        if (params.has('googleCalendar')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('googleCalendar');
            url.searchParams.delete('reason');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Persist filter to localStorage
    useEffect(() => {
        localStorage.setItem('calendar_filter', activeFilter);
    }, [activeFilter]);

    const loadStatus = useCallback(async () => {
        setStatusLoading(true);
        try {
            const status = await getGoogleCalendarStatus();
            setConnected(status.connected);
            setConnectedEmail(status.email);
        } catch {
            setConnected(false);
        } finally {
            setStatusLoading(false);
        }
    }, []);

    const loadEvents = useCallback(async (filter: TimeFilter) => {
        setLoading(true);
        setError(null);
        try {
            const range = getFilterRange(filter);
            const data = await listUpcomingEvents({
                maxResults: 100,
                timeMin: range.timeMin,
                timeMax: range.timeMax
            });
            setEvents(data);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load events.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    // On mount, check status
    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // When connected or filter changes, load events
    useEffect(() => {
        if (connected === true) {
            loadEvents(activeFilter);
        }
    }, [connected, activeFilter, loadEvents]);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const url = await getGoogleConnectUrl();
            window.location.href = url;
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Failed to start Google connection.');
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await disconnectGoogleCalendar();
            setConnected(false);
            setConnectedEmail(null);
            setEvents([]);
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Failed to disconnect.');
        } finally {
            setDisconnecting(false);
        }
    };

    const handleDeleteEvent = (id: string) => {
        setConfirmModal({
            show: true,
            title: 'Delete Event',
            message: 'Are you sure you want to delete this calendar event? This action cannot be undone.',
            danger: true,
            onConfirm: async () => {
                try {
                    await deleteEvent(id);
                    setEvents((prev) => prev.filter((e) => e.id !== id));
                } catch (err: any) {
                    setConfirmModal({
                        show: true,
                        title: 'Error Deleting',
                        message: err?.response?.data?.message ?? 'The action failed.',
                        type: 'alert',
                        danger: true,
                        onConfirm: () => { }
                    });
                }
            }
        });
    };

    const handleSaveEvent = async (data: any) => {
        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, data);
            } else {
                await createEvent(data);
            }
            loadEvents(activeFilter); // Refresh list
        } catch (err: any) {
            throw err; // Let modal handle it
        }
    };

    const grouped = groupEventsByDate(events);
    const sortedDateKeys = Array.from(grouped.keys()).sort();

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="page-header mb-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'var(--accent-bg)',
                            border: '1px solid var(--accent-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0,
                        }}
                    >
                        <CalendarDays size={20} />
                    </div>
                    <div>
                        <h1 className="page-title">Calendar</h1>
                        <p className="page-subtitle">Your upcoming Google Calendar appointments</p>
                    </div>
                </div>

                {connected && (
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filter Select */}
                        <div className="relative group">
                            <label className="absolute -top-2 left-3 px-1 text-[10px] font-bold uppercase tracking-wider bg-bg-page text-muted z-10">
                                Range
                            </label>
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-hover:text-accent transition-colors" />
                                <select
                                    value={activeFilter}
                                    onChange={(e) => setActiveFilter(e.target.value as TimeFilter)}
                                    className="input-base pl-9 pr-10 py-2.5 min-w-[160px] appearance-none cursor-pointer group-hover:border-accent transition-colors"
                                >
                                    {FILTER_OPTIONS.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            </div>
                        </div>

                        <button
                            onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                            className="btn-primary gap-2"
                        >
                            <Plus size={18} />
                            Add Event
                        </button>
                    </div>
                )}
            </div>

            {/* Error banner */}
            {error && (
                <div className="alert-error flex items-start gap-2 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Status loading */}
            {statusLoading ? (
                <div className="flex items-center justify-center py-24 gap-3" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-sm">Checking connection…</span>
                </div>
            ) : !connected ? (
                /* ── NOT CONNECTED ─────────────────────────────────────────── */
                <div className="flex items-center justify-center py-10">
                    <div
                        className="card p-10 flex flex-col items-center text-center gap-6"
                        style={{ maxWidth: 460 }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 20,
                                background: 'var(--accent-bg)',
                                border: '1px solid var(--accent-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent)',
                            }}
                        >
                            <Calendar size={32} />
                        </div>

                        <div>
                            <h2
                                className="text-xl font-semibold mb-2"
                                style={{ color: 'var(--text-primary)', fontFamily: 'Fraunces, Georgia, serif' }}
                            >
                                Connect Google Calendar
                            </h2>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                Sync your Google Calendar to view upcoming appointments, interviews, and scheduled events right here in VibeHired.
                            </p>
                        </div>

                        {/* Feature bullets */}
                        <ul className="w-full space-y-2 text-left">
                            {[
                                'View all upcoming events in one place',
                                'See interview slots alongside your applications',
                                'Reminders you add appear automatically here',
                            ].map((text) => (
                                <li key={text} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <CheckCircle2 size={14} style={{ color: 'var(--jade)', flexShrink: 0 }} />
                                    {text}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="btn-primary flex items-center gap-2 w-full justify-center disabled:opacity-50"
                        >
                            {connecting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Redirecting to Google…
                                </>
                            ) : (
                                <>
                                    <Link2 size={16} />
                                    Connect Google Calendar
                                </>
                            )}
                        </button>

                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            We only request read access to your calendar events. You can disconnect at any time.
                        </p>
                    </div>
                </div>
            ) : (
                /* ── CONNECTED ─────────────────────────────────────────────── */
                <div className="space-y-6">
                    {/* Connection status bar */}
                    <div
                        className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: 'var(--jade)',
                                    boxShadow: '0 0 0 3px rgba(45,212,160,0.15)',
                                    flexShrink: 0,
                                }}
                            />
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    Google Calendar connected
                                </p>
                                {connectedEmail && (
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{connectedEmail}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadEvents(activeFilter)}
                                disabled={loading}
                                className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-2"
                                title="Refresh events"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                            <button
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="btn-danger flex items-center gap-1.5 text-xs px-3 py-2"
                                title="Disconnect Google Calendar"
                            >
                                {disconnecting ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Link2Off size={13} />
                                )}
                                Disconnect
                            </button>
                        </div>
                    </div>

                    {/* Events list */}
                    {loading ? (
                        <LoadingSkeleton />
                    ) : sortedDateKeys.length === 0 ? (
                        /* Empty state */
                        <div
                            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
                        >
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 16,
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                <CalendarDays size={26} />
                            </div>
                            <div>
                                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                                    No events found
                                </p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {activeFilter === 'upcoming'
                                        ? "Your Google Calendar doesn't have any upcoming events."
                                        : `No events scheduled for the selected range (${FILTER_OPTIONS.find(o => o.id === activeFilter)?.label}).`}
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Grouped event list */
                        <div className="space-y-7 animate-stagger">
                            {sortedDateKeys.map((dateKey) => {
                                const dayEvents = grouped.get(dateKey)!;
                                const today = isToday(dateKey);
                                return (
                                    <div key={dateKey}>
                                        {/* Date heading */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <p
                                                className="text-sm font-semibold"
                                                style={{
                                                    color: today ? 'var(--accent)' : 'var(--text-primary)',
                                                    fontFamily: 'Fraunces, Georgia, serif',
                                                }}
                                            >
                                                {formatDateHeading(dateKey)}
                                            </p>
                                            {today && (
                                                <span className="badge badge-gold text-[10px]">today</span>
                                            )}
                                            <div
                                                className="flex-1 h-px"
                                                style={{ background: 'var(--border-subtle)' }}
                                            />
                                            <span
                                                className="text-xs font-mono"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* Events for this day */}
                                        <div className="space-y-2">
                                            {dayEvents.map((ev) => (
                                                <EventRow
                                                    key={ev.id}
                                                    event={ev}
                                                    onEdit={(e) => { setEditingEvent(e); setShowEventModal(true); }}
                                                    onDelete={handleDeleteEvent}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showEventModal && (
                <EventModal
                    event={editingEvent}
                    onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
                    onSave={handleSaveEvent}
                />
            )}

            <ConfirmModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                danger={confirmModal.danger}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
            />
        </div>
    );
};

export default CalendarPage;
