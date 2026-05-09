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
    ChevronLeft,
    ChevronRight,
    List,
    LayoutGrid,
    Video,
    Users,
    Star,
    CalendarX,
    Sparkles,
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

type ViewMode = 'list' | 'month';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    const d = new Date(dateKey + 'T12:00:00');
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

function getEventCategory(summary: string = ''): { label: string; color: string; bg: string; border: string; icon: React.ReactNode } {
    const s = summary.toLowerCase();
    if (s.includes('interview') || s.includes('screening')) {
        return { label: 'Interview', color: '#006241', bg: 'rgba(0,98,65,0.08)', border: 'rgba(0,98,65,0.2)', icon: <Users size={12} /> };
    }
    if (s.includes('sync') || s.includes('standup') || s.includes('team')) {
        return { label: 'Team', color: '#1E3932', bg: 'rgba(30,57,50,0.08)', border: 'rgba(30,57,50,0.2)', icon: <Video size={12} /> };
    }
    if (s.includes('review') || s.includes('launch') || s.includes('product')) {
        return { label: 'Product', color: '#8a6d2b', bg: 'rgba(203,162,88,0.12)', border: 'rgba(203,162,88,0.25)', icon: <Star size={12} /> };
    }
    if (s.includes('workshop') || s.includes('coffee') || s.includes('community')) {
        return { label: 'Event', color: '#00754A', bg: 'rgba(0,117,74,0.08)', border: 'rgba(0,117,74,0.2)', icon: <Sparkles size={12} /> };
    }
    return { label: 'Meeting', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', border: 'var(--border)', icon: <CalendarDays size={12} /> };
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
    const days = getDaysInMonth(year, month);
    const firstDay = days[0].getDay(); // 0 = Sunday
    const grid: (Date | null)[][] = [];
    let week: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) week.push(null);
    for (const day of days) {
        week.push(day);
        if (week.length === 7) {
            grid.push(week);
            week = [];
        }
    }
    if (week.length > 0) {
        while (week.length < 7) week.push(null);
        grid.push(week);
    }
    return grid;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface EventRowProps {
    event: CalendarEvent;
    onEdit: (ev: CalendarEvent) => void;
    onDelete: (id: string) => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, onEdit, onDelete }) => {
    const category = getEventCategory(event.summary);
    const isAllDay = event.start.date && !event.start.dateTime;

    return (
        <div
            className="group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer"
            style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
        >
            {/* Left accent bar */}
            <div
                className="absolute left-0 top-4 bottom-4 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: category.color }}
            />

            {/* Time column */}
            <div className="flex flex-col items-center justify-center min-w-[64px] py-1 border-r border-dashed shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {isAllDay ? '—' : formatTime(event.start).replace(/\s[AP]M/, '')}
                </span>
                {!isAllDay && (
                    <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {formatTime(event.start).includes('AM') ? 'AM' : 'PM'}
                    </span>
                )}
                {isAllDay && (
                    <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        All day
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {event.summary}
                    </h3>
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{
                            color: category.color,
                            background: category.bg,
                            border: `1px solid ${category.border}`,
                        }}
                    >
                        {category.icon}
                        {category.label}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {event.location && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <MapPin size={12} />
                            <span className="truncate max-w-[180px]">{event.location}</span>
                        </span>
                    )}
                    {event.description && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <FileText size={12} />
                            <span className="truncate max-w-[200px]">{event.description}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Edit event"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                    <Pencil size={15} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete event"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--rose-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--rose)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
};

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-6">
        {[1, 2, 3].map((group) => (
            <div key={group}>
                <div className="shimmer h-5 w-48 rounded-md mb-3" />
                <div className="space-y-2">
                    {[1, 2].map((item) => (
                        <div key={item} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div className="shimmer h-8 w-14 rounded-md shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="shimmer h-4 w-3/4 rounded-md" />
                                <div className="shimmer h-3 w-1/2 rounded-md" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// ─── Mini Calendar ───────────────────────────────────────────────────────────

interface MiniCalendarProps {
    events: CalendarEvent[];
    onDateSelect?: (date: Date) => void;
    selectedDate?: Date | null;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ events, onDateSelect }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const eventDates = useMemo(() => {
        const set = new Set<string>();
        events.forEach((ev) => {
            const d = parseEventDate(ev.start);
            if (d) set.add(formatDateKey(d));
        });
        return set;
    }, [events]);

    const grid = useMemo(() => getMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);
    const todayKey = formatDateKey(new Date());

    const navigateMonth = (delta: number) => {
        setCurrentMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + delta);
            return next;
        });
    };

    return (
        <div className="p-5 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wider py-1" style={{ color: 'var(--text-muted)' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="space-y-1">
                {grid.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                        {week.map((day, di) => {
                            if (!day) return <div key={di} className="h-8" />;
                            const key = formatDateKey(day);
                            const hasEvent = eventDates.has(key);
                            const isToday = key === todayKey;

                            return (
                                <button
                                    key={di}
                                    onClick={() => onDateSelect?.(day)}
                                    className="relative h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium rounded-lg transition-all"
                                    style={{
                                        color: isToday ? '#fff' : 'var(--text-primary)',
                                        background: isToday ? 'var(--accent)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isToday) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                >
                                    {day.getDate()}
                                    {hasEvent && (
                                        <span
                                            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                                            style={{ background: isToday ? '#fff' : 'var(--accent)' }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Month Grid View ─────────────────────────────────────────────────────────

interface MonthGridViewProps {
    events: CalendarEvent[];
    onEdit: (ev: CalendarEvent) => void;
    onDelete: (id: string) => void;
}

const MonthGridView: React.FC<MonthGridViewProps> = ({ events, onEdit, onDelete }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const grid = useMemo(() => getMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach((ev) => {
            const d = parseEventDate(ev.start);
            if (!d) return;
            const key = formatDateKey(d);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        });
        return map;
    }, [events]);

    const navigateMonth = (delta: number) => {
        setCurrentMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + delta);
            return next;
        });
    };

    const todayKey = formatDateKey(new Date());

    return (
        <div className="space-y-4">
            {/* Month header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-2 rounded-lg border transition-all"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-2 rounded-lg border transition-all"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-2">
                {grid.flat().map((day, i) => {
                    if (!day) {
                        return (
                            <div
                                key={i}
                                className="min-h-[120px] rounded-xl"
                                style={{ background: 'var(--bg-elevated)', opacity: 0.5 }}
                            />
                        );
                    }
                    const key = formatDateKey(day);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isToday = key === todayKey;

                    return (
                        <div
                            key={i}
                            className="min-h-[120px] rounded-xl p-2 transition-all border"
                            style={{
                                background: isToday ? 'rgba(0,98,65,0.04)' : 'var(--bg-surface)',
                                borderColor: isToday ? 'var(--accent)' : 'var(--border-subtle)',
                            }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                                    style={{
                                        color: isToday ? '#fff' : 'var(--text-primary)',
                                        background: isToday ? 'var(--accent)' : 'transparent',
                                    }}
                                >
                                    {day.getDate()}
                                </span>
                                {dayEvents.length > 0 && (
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                        {dayEvents.length}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                {dayEvents.slice(0, 3).map((ev) => {
                                    const cat = getEventCategory(ev.summary);
                                    return (
                                        <button
                                            key={ev.id}
                                            onClick={() => onEdit(ev)}
                                            className="w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium truncate transition-colors"
                                            style={{
                                                background: cat.bg,
                                                color: cat.color,
                                                border: `1px solid ${cat.border}`,
                                            }}
                                            title={ev.summary}
                                        >
                                            {!ev.start.dateTime && ev.start.date ? 'All day' : formatTime(ev.start)} · {ev.summary}
                                        </button>
                                    );
                                })}
                                {dayEvents.length > 3 && (
                                    <span className="text-[10px] px-2" style={{ color: 'var(--text-muted)' }}>
                                        +{dayEvents.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Event Modal ─────────────────────────────────────────────────────────────

interface EventModalProps {
    event?: CalendarEvent | null;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, onSave }) => {
    const [summary, setSummary] = useState(event?.summary ?? '');
    const [location, setLocation] = useState(event?.location ?? '');
    const [description, setDescription] = useState(event?.description ?? '');

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="w-full max-w-lg flex flex-col animate-fade-in-up"
                style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    maxHeight: '90vh',
                }}
            >
                <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {event ? 'Edit Event' : 'Add New Event'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
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
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input
                                className="input-base pl-9"
                                placeholder="Add location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="label-overline">Description</label>
                        <textarea
                            className="input-base resize-none min-h-[100px]"
                            placeholder="Add details, notes, or links"
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

// ─── Main Page ───────────────────────────────────────────────────────────────

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
    const [viewMode, setViewMode] = useState<ViewMode>('list');

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

    // Persist view mode
    useEffect(() => {
        const saved = localStorage.getItem('calendar_view') as ViewMode;
        if (saved === 'list' || saved === 'month') setViewMode(saved);
    }, []);

    const handleViewChange = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('calendar_view', mode);
    };

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
            const status = err?.response?.status;
            const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load events.';
            if (status === 401 || status === 403) {
                setConnected(false);
                setConnectedEmail(null);
                setEvents([]);
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

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
            loadEvents(activeFilter);
        } catch (err: any) {
            throw err;
        }
    };

    const grouped = groupEventsByDate(events);
    const sortedDateKeys = Array.from(grouped.keys()).sort();

    const upcomingCount = events.length;
    const thisWeekCount = events.filter((ev) => {
        const d = parseEventDate(ev.start);
        if (!d) return false;
        const now = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(now.getDate() + 7);
        return d >= now && d <= weekFromNow;
    }).length;

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 max-w-[1440px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'var(--accent-bg)',
                                border: '1px solid rgba(0,98,65,0.15)',
                                color: 'var(--accent)',
                            }}
                        >
                            <CalendarDays size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Your Calendar
                            </h1>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Stay organized with your upcoming events and schedule
                            </p>
                        </div>
                    </div>
                </div>

                {connected && (
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View Toggle */}
                        <div className="flex items-center p-1 rounded-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <button
                                onClick={() => handleViewChange('list')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                                style={{
                                    background: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                                    color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-muted)',
                                    boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                            >
                                <List size={14} />
                                List
                            </button>
                            <button
                                onClick={() => handleViewChange('month')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                                style={{
                                    background: viewMode === 'month' ? 'var(--bg-surface)' : 'transparent',
                                    color: viewMode === 'month' ? 'var(--accent)' : 'var(--text-muted)',
                                    boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                            >
                                <LayoutGrid size={14} />
                                Month
                            </button>
                        </div>

                        {/* Filter Select */}
                        <div className="relative group">
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <select
                                    value={activeFilter}
                                    onChange={(e) => setActiveFilter(e.target.value as TimeFilter)}
                                    className="input-base pl-9 pr-10 py-2.5 min-w-[160px] appearance-none cursor-pointer text-sm"
                                    style={{ paddingRight: '2.5rem' }}
                                >
                                    {FILTER_OPTIONS.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
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

            {/* Error Banner */}
            {error && (
                <div className="alert-error flex items-start gap-2 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Status Loading */}
            {statusLoading ? (
                <div className="flex items-center justify-center py-24 gap-3" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-sm">Checking connection</span>
                </div>
            ) : !connected ? (
                /* ─── NOT CONNECTED ─── */
                <div className="flex items-center justify-center py-10">
                    <div
                        className="p-8 sm:p-10 flex flex-col items-center text-center gap-6"
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 20,
                            maxWidth: 460,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        }}
                    >
                        {/* Icon */}
                        <div
                            className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                            style={{
                                background: 'var(--accent-bg)',
                                border: '1px solid rgba(0,98,65,0.15)',
                                color: 'var(--accent)',
                            }}
                        >
                            <Calendar size={32} />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                                Connect Google Calendar
                            </h2>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                Sync your Google Calendar to view upcoming appointments, interviews, and scheduled events right here in VibeHired.
                            </p>
                        </div>

                        {/* Feature bullets */}
                        <ul className="w-full space-y-3 text-left">
                            {[
                                'View all upcoming events in one place',
                                'See interview slots alongside your applications',
                                'Reminders you add appear automatically here',
                            ].map((text) => (
                                <li key={text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                                    >
                                        <CheckCircle2 size={12} />
                                    </div>
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
                                    Redirecting to Google
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
                /* ─── CONNECTED ─── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Sidebar */}
                    <aside className="lg:col-span-4 xl:col-span-3 space-y-5">
                        {/* Connection Status Card */}
                        <div
                            className="p-5 rounded-xl"
                            style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            }}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                        <path d="M22 9V14C22 15.66 20.66 17 19 17H18V12C18 10.34 16.66 9 15 9H5V6C5 4.34 6.34 3 8 3H19C20.66 3 22 4.34 22 6V9Z" fill="#4285F4" />
                                        <path d="M17 12V21C17 21.55 16.55 22 16 22H5C4.45 22 4 21.55 4 21V12C4 11.45 4.45 11 5 11H16C16.55 11 17 11.45 17 12Z" fill="#34A853" />
                                        <path d="M11 7V11H5V7C5 6.45 5.45 6 6 6H10C10.55 6 11 6.45 11 7Z" fill="#FBBC04" />
                                        <path d="M16 6H19C19.55 6 20 6.45 20 7V11H17V7C17 6.45 16.55 6 16 6Z" fill="#EA4335" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                        Google Calendar
                                    </h3>
                                    {connectedEmail && (
                                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{connectedEmail}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full" style={{ background: '#00754A', boxShadow: '0 0 0 3px rgba(0,117,74,0.15)' }} />
                                <span className="text-xs font-semibold" style={{ color: '#00754A' }}>Live Syncing Active</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => loadEvents(activeFilter)}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all border"
                                    style={{
                                        borderColor: 'var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        background: 'transparent',
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={disconnecting}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all"
                                    style={{
                                        background: 'var(--rose-bg)',
                                        color: 'var(--rose)',
                                        border: '1px solid rgba(200,32,20,0.2)',
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,32,20,0.14)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--rose-bg)'; }}
                                >
                                    {disconnecting ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Link2Off size={12} />
                                    )}
                                    Disconnect
                                </button>
                            </div>
                        </div>

                        {/* Mini Calendar */}
                        <MiniCalendar events={events} />

                        {/* Quick Stats */}
                        <div
                            className="p-5 rounded-xl"
                            style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            }}
                        >
                            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                                Overview
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Upcoming events</span>
                                    <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{upcomingCount}</span>
                                </div>
                                <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>This week</span>
                                    <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{thisWeekCount}</span>
                                </div>
                                <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active filter</span>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                        {FILTER_OPTIONS.find((o) => o.id === activeFilter)?.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        {loading ? (
                            <LoadingSkeleton />
                        ) : viewMode === 'month' ? (
                            <MonthGridView
                                events={events}
                                onEdit={(e) => { setEditingEvent(e); setShowEventModal(true); }}
                                onDelete={handleDeleteEvent}
                            />
                        ) : sortedDateKeys.length === 0 ? (
                            /* Empty state */
                            <div
                                className="flex flex-col items-center justify-center py-24 gap-5 text-center rounded-xl"
                                style={{
                                    background: 'var(--bg-surface)',
                                    border: '1px dashed var(--border)',
                                }}
                            >
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    <CalendarX size={28} />
                                </div>
                                <div>
                                    <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        No events found
                                    </p>
                                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {activeFilter === 'upcoming'
                                            ? "Your Google Calendar doesn't have any upcoming events."
                                            : `No events scheduled for the selected range (${FILTER_OPTIONS.find((o) => o.id === activeFilter)?.label}).`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                                    className="btn-primary gap-2"
                                >
                                    <Plus size={16} />
                                    Create Event
                                </button>
                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-8 animate-stagger">
                                {sortedDateKeys.map((dateKey) => {
                                    const dayEvents = grouped.get(dateKey)!;
                                    const today = isToday(dateKey);
                                    return (
                                        <div key={dateKey}>
                                            {/* Date heading */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <p
                                                        className="text-sm font-bold"
                                                        style={{
                                                            color: today ? 'var(--accent)' : 'var(--text-primary)',
                                                            fontFamily: 'var(--font-display)',
                                                        }}
                                                    >
                                                        {formatDateHeading(dateKey)}
                                                    </p>
                                                    {today && (
                                                        <span
                                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                            style={{
                                                                background: 'var(--accent-bg)',
                                                                color: 'var(--accent)',
                                                                border: '1px solid rgba(0,98,65,0.2)',
                                                            }}
                                                        >
                                                            Today
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                                                <span
                                                    className="text-xs font-mono font-medium"
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
                onClose={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
            />
        </div>
    );
};

export default CalendarPage;
