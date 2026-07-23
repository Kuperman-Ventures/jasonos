import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WeekPlanner from './components/WeekPlanner'
import NYUIScreen from './components/NYUIScreen'
import { Pause, Play, SquareCheck, StopCircle, GripVertical, AlertTriangle, Clock, ChevronDown, ChevronRight, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import {
  upsertTaskTemplates,
  loadTaskTemplates,
  upsertTodayTasks,
  replaceTodayTasks,
  loadTodayTasks,
  upsertTimerSession,
  loadTimerSessions,
  loadTodayTimerSessions,
  upsertFridayReview,
  loadFridayReviews,
  loadUserPreferences,
  upsertUserPreferences,
  upsertQuickLogEntry,
  loadQuickLogEntries,
  deleteQuickLogEntry,
  updateQuickLogEntry,
  loadCalendarEventTags,
  deleteTimerSession,
  updateTimerSession,
} from './lib/supabaseSync'
import {
  fetchAllCalendarEvents,
  fetchCoSACalendarEvents,
  fetchPersonalCalendarEvents,
  GCalAuthError,
} from './lib/googleCalendar'
import {
  allocationsPercentToTrackTargets,
  buildCalendarHealthModel,
  COSA_ALLOCATION_DEFAULTS,
  formatLocalDate,
} from './lib/calendarWeekHealthModel'
import { QUICK_LOG_KPI_GROUPS, KPI_LABEL_TO_TRACK } from './lib/quickLogKpis'
import { exportWeeklyReportHTML } from './lib/weeklyReportExport'

const TRACKS = {
  advisors: {
    key: 'advisors',
    label: 'Kuperman Advisors',
    color: '#1E6B3C',
    priority: 1,
  },
  jobSearch: {
    key: 'jobSearch',
    label: 'Job Search',
    color: '#2E75B6',
    priority: 2,
  },
  ventures: {
    key: 'ventures',
    label: 'Kuperman Ventures',
    color: '#9B6BAE',
    priority: 3,
  },
  networking: {
    key: 'networking',
    label: 'Shared Networking',
    color: '#B8600B',
    priority: 4,
  },
  development: {
    key: 'development',
    label: 'Development',
    color: '#7c3aed',
    priority: 5,
  },
  cosaAdmin: {
    key: 'cosaAdmin',
    label: 'Administration',
    color: '#0891b2',
    priority: 6,
  },
}

const TIMER_STATES = {
  notStarted: 'Not Started',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const LIBRARY_STATUSES = ['Active', 'Paused', 'Archived']
const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
// Sub-tracks per track — kept in sync with WeekPlanner TRACK_SUB_TRACKS / DEFAULT_ALLOCATIONS
const TRACK_SUB_TRACKS = {
  advisors:    ['Networking & Business Development', 'Materials', 'Product', 'Client Work', 'Back Office'],
  jobSearch:   ['Network Development & Outreach', 'Searching', 'Materials'],
  ventures:    ['Alpha', 'Product', 'Beta Prep'],
  networking:  [],
  development: [],
  cosaAdmin:   [],
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const INITIAL_TASK_LIBRARY = [
  // ─── KUPERMAN ADVISORS — BD Block ─────────────────────────────────────────
  {
    id: 'lib-v2-advisors-1',
    name: 'ICP Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-2',
    name: 'ICP Contact Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-3',
    name: 'Deep Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 45,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-4',
    name: 'Outreach Emails',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-5',
    name: 'Apollo Sequences',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-6',
    name: 'Materials Refinement',
    track: TRACKS.advisors.key,
    subTrack: 'Materials',
    defaultTimeEstimate: 45,
    kpiMapping: 'Case study progress',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-7',
    name: 'LinkedIn Content',
    track: TRACKS.advisors.key,
    subTrack: 'Content',
    defaultTimeEstimate: 45,
    kpiMapping: 'LinkedIn comments posted',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-8',
    name: 'Connective Meeting Prep',
    track: TRACKS.advisors.key,
    subTrack: 'Meetings',
    defaultTimeEstimate: 20,
    kpiMapping: 'Connective attendance',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-9',
    name: 'Discovery Call',
    track: TRACKS.advisors.key,
    subTrack: 'Meetings',
    defaultTimeEstimate: 60,
    kpiMapping: 'Discovery calls held',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-10',
    name: 'Follow-Up Review',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 20,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-11',
    name: 'Proposals',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 60,
    kpiMapping: 'Discovery calls held',
    status: 'Paused',
  },
  {
    id: 'lib-v2-advisors-12',
    name: 'Agreements',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 45,
    kpiMapping: 'Discovery calls held',
    status: 'Paused',
  },
  {
    id: 'lib-v2-advisors-13',
    name: 'Follow Up on Responses',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  // ─── JOB SEARCH — Job Search Block ───────────────────────────────────────
  {
    id: 'lib-v2-jobsearch-1',
    name: 'Network Follow-Ups',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 20,
    kpiMapping: 'Recruiter touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-2',
    name: 'Warm Reconnect Outreach',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 15,
    kpiMapping: 'Warm reconnects sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-3',
    name: 'Cold Outreach',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-4',
    name: 'Industry Reading & L&D',
    track: TRACKS.jobSearch.key,
    subTrack: 'L&D',
    defaultTimeEstimate: 30,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-5',
    name: 'Target Company List Review',
    track: TRACKS.jobSearch.key,
    subTrack: 'Searching',
    defaultTimeEstimate: 30,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-6',
    name: 'Job Listing Review',
    track: TRACKS.jobSearch.key,
    subTrack: 'Searching',
    defaultTimeEstimate: 30,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-7',
    name: 'Tailored Application',
    track: TRACKS.jobSearch.key,
    subTrack: 'Applications',
    defaultTimeEstimate: 60,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-8',
    name: 'Update EncoreOS Tracker',
    track: TRACKS.jobSearch.key,
    subTrack: 'Admin',
    defaultTimeEstimate: 15,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-9',
    name: 'Networking Meeting or Event',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 60,
    kpiMapping: 'Coffee chats held',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-10',
    name: 'Resume Customisation',
    track: TRACKS.jobSearch.key,
    subTrack: 'Applications',
    defaultTimeEstimate: 45,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-11',
    name: 'Board Research',
    track: TRACKS.jobSearch.key,
    subTrack: 'Boards',
    defaultTimeEstimate: 30,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  // ─── KUPERMAN VENTURES — Encore OS Block ─────────────────────────────────
  {
    id: 'lib-v2-ventures-1',
    name: 'Alpha Tester Outreach',
    track: TRACKS.ventures.key,
    subTrack: 'Alpha',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-2',
    name: 'Alpha Growth Outreach',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 25,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-3',
    name: 'Roadmap Review',
    track: TRACKS.ventures.key,
    subTrack: 'Product',
    defaultTimeEstimate: 30,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-4',
    name: 'Feature Research',
    track: TRACKS.ventures.key,
    subTrack: 'Research',
    defaultTimeEstimate: 25,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-5',
    name: 'Subscription Research',
    track: TRACKS.ventures.key,
    subTrack: 'Subscription',
    defaultTimeEstimate: 25,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-6',
    name: 'Cursor Build Session',
    track: TRACKS.ventures.key,
    subTrack: 'Build',
    defaultTimeEstimate: 90,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-7',
    name: 'New User Targeting',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  // ─── MARC WHITMAN — Temporary Tasks ──────────────────────────────────────
  {
    id: 'lib-ventures-marc-prep-20260315',
    name: 'Marc Whitman — Meeting Prep',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-ventures-marc-debrief-20260315',
    name: 'Marc Whitman — Debrief',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 20,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  // ─── FRIDAY REVIEW Block ──────────────────────────────────────────────────
  {
    id: 'lib-friday-1',
    name: 'Score the Week',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 20,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-2',
    name: 'Three Questions',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 15,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-3',
    name: 'Plan Next Week',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 20,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-4',
    name: 'Clean Up',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 5,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
]

const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'taskLibrary', label: 'Task Library' },
  { id: 'weekPlanner', label: 'Calendar' },
  { id: 'kpi', label: 'Weekly Review' },
  { id: 'nyui', label: 'NYUI' },
]
const STORAGE_KEY = 'cosa.phase1_phase2.local_state.v5'
const COMPLETION_LOG_KEY = 'cosa.completion_log.v1'

// ─── Per-track KPI inputs shown in the active task panel ─────────────────────
// type 'count'   → quick-select buttons [1..6] + free number field
// type 'boolean' → single YES toggle
// type 'venue'   → dropdown with named options
const TRACK_KPI_INPUTS = {
  advisors: [
    { id: 'outreachSent',               label: 'Outreach message sent',       type: 'count',   quickCounts: [1,2,3,4,5,6] },
    { id: 'discoveryCallHeld',          label: 'Discovery call held',          type: 'boolean' },
    { id: 'discoveryCallBooked',        label: 'Discovery call booked',        type: 'boolean' },
    { id: 'networkingMeetingAttended',  label: 'Networking meeting attended',  type: 'venue',   options: ['The Connective', 'Other'] },
  ],
  jobSearch: [
    { id: 'companiesResearched',  label: 'Companies researched',    type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'companyOutreaches',    label: 'Company outreaches',      type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'rolesIdentified',      label: 'Roles identified',        type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'applications',         label: 'Applications',            type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'recruiterTouchpoints', label: 'Recruiter touchpoints',   type: 'count', quickCounts: [1,2,3,4,5,6] },
  ],
  ventures: [
    { id: 'alphaTesterTouchpoints', label: 'Alpha tester touchpoints', type: 'count', quickCounts: [1,2,3,4,5,6] },
  ],
  networking: [
    { id: 'warmReconnectComms', label: 'Warm reconnect communications', type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'linkedinComments',   label: 'LinkedIn comments posted',      type: 'count', quickCounts: [1,2,3,4,5,6] },
    { id: 'contentPosts',       label: 'Content posts',                 type: 'count', quickCounts: [1,2,3,4,5,6] },
  ],
}

// Weekly-Review KPI definitions — each kpiValueId maps to a key in session.kpiValues.
// kpiMapping is kept for backward-compat so old sessions still count in countKpi.
const KPI_DEFINITIONS = [
  // ─── Kuperman Advisors ────────────────────────────────────────────────────
  { id: 'outreach-messages', label: 'Outreach messages sent',      kpiValueId: 'outreachSent',              target: 6, period: 'week',  kpiMapping: 'Outreach messages sent',  trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'discovery-held',    label: 'Discovery calls held',         kpiValueId: 'discoveryCallHeld',         target: 1, period: 'week',  kpiMapping: 'Discovery calls held',    trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'discovery-booked',  label: 'Discovery calls booked',       kpiValueId: 'discoveryCallBooked',       target: 2, period: 'week',  kpiMapping: 'Discovery calls booked',  trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'networking-meeting',label: 'Networking meetings attended', kpiValueId: 'networkingMeetingAttended', target: 1, period: 'week',  kpiMapping: 'Connective attendance',   trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  // ─── Shared networking metrics (logged on networking track; shown under both groups) ──
  // countsTowardWeekScore: Job Search copies are display-only so the week score is not doubled.
  { id: 'warm-reconnects',   label: 'Warm reconnect communications', kpiValueId: 'warmReconnectComms', target: 3, period: 'week', kpiMapping: 'Warm reconnects sent',    trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'linkedin-comments', label: 'LinkedIn comments posted',      kpiValueId: 'linkedinComments',   target: 5, period: 'week', kpiMapping: 'LinkedIn comments posted',trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'content-posts',     label: 'Content posts',                 kpiValueId: 'contentPosts',       target: 1, period: 'week', kpiMapping: 'Content posts',           trackGroup: 'Kuperman Advisors', color: '#1E6B3C' },
  { id: 'warm-reconnects-js',   label: 'Warm reconnect communications', kpiValueId: 'warmReconnectComms', target: 3, period: 'week', kpiMapping: 'Warm reconnects sent',    trackGroup: 'Job Search', color: '#2E75B6', countsTowardWeekScore: false },
  { id: 'linkedin-comments-js', label: 'LinkedIn comments posted',      kpiValueId: 'linkedinComments',   target: 5, period: 'week', kpiMapping: 'LinkedIn comments posted',trackGroup: 'Job Search', color: '#2E75B6', countsTowardWeekScore: false },
  { id: 'content-posts-js',     label: 'Content posts',                 kpiValueId: 'contentPosts',       target: 1, period: 'week', kpiMapping: 'Content posts',           trackGroup: 'Job Search', color: '#2E75B6', countsTowardWeekScore: false },
  // ─── Job Search ──────────────────────────────────────────────────────────
  { id: 'companies-researched',  label: 'Companies researched',   kpiValueId: 'companiesResearched',  target: 5, period: 'week', kpiMapping: 'Companies researched',   trackGroup: 'Job Search', color: '#2E75B6' },
  { id: 'company-outreaches',    label: 'Company outreaches',     kpiValueId: 'companyOutreaches',    target: 5, period: 'week', kpiMapping: 'Company outreaches',     trackGroup: 'Job Search', color: '#2E75B6' },
  { id: 'roles-identified',      label: 'Roles identified',        kpiValueId: 'rolesIdentified',      target: 5, period: 'week', kpiMapping: 'Roles identified',       trackGroup: 'Job Search', color: '#2E75B6' },
  { id: 'applications',          label: 'Applications submitted',  kpiValueId: 'applications',         target: 3, period: 'week', kpiMapping: 'Applications submitted', trackGroup: 'Job Search', color: '#2E75B6' },
  { id: 'recruiter-touchpoints', label: 'Recruiter touchpoints',   kpiValueId: 'recruiterTouchpoints', target: 3, period: 'week', kpiMapping: 'Recruiter touchpoints',  trackGroup: 'Job Search', color: '#2E75B6' },
  // ─── Kuperman Ventures ───────────────────────────────────────────────────
  { id: 'alpha-tester-touchpoints', label: 'Alpha tester touchpoints', kpiValueId: 'alphaTesterTouchpoints', target: 3, period: 'week', kpiMapping: 'Tester touchpoints', trackGroup: 'Kuperman Ventures', color: '#9B6BAE' },
]

const KPI_TRACK_GROUPS = ['Kuperman Advisors', 'Job Search', 'Kuperman Ventures']

const QUICK_LOG_LOCAL_KEY = 'cosa_quick_logs_v1'

// Subtasks are stored in their own localStorage key, completely decoupled from
// the Supabase task_templates sync cycle. This guarantees they survive even if
// the DB column is missing or PostgREST silently drops the field.
const SUBTASKS_LOCAL_KEY = 'cosa.taskSubtasks.v1' // { [taskId]: subtask[] }

function loadSubtasksMap() {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(SUBTASKS_LOCAL_KEY)
  const parsed = safeParseJSON(raw)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function saveSubtasksMap(map) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SUBTASKS_LOCAL_KEY, JSON.stringify(map))
}

function mergeSubtasksIntoLibrary(library) {
  const map = loadSubtasksMap()
  if (Object.keys(map).length === 0) return library
  return library.map((t) => ({
    ...t,
    subtasks: map[t.id] ?? t.subtasks ?? [],
  }))
}

function loadCompletionLog() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(COMPLETION_LOG_KEY)
  const parsed = safeParseJSON(raw)
  return Array.isArray(parsed) ? parsed : []
}

function saveCompletionLog(log) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COMPLETION_LOG_KEY, JSON.stringify(log))
}


// ─── Eastern Time date helpers ────────────────────────────────────────────────
// All "day" boundaries are anchored to midnight America/New_York (handles
// both EST UTC-5 and EDT UTC-4 automatically), so "today" never rolls over
// before midnight Eastern regardless of the machine's system timezone.

// Returns YYYY-MM-DD in Eastern Time for a given Date (default: now).
function getETDateStr(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// Returns a Date (UTC) representing midnight Eastern Time for an ET date string.
// Probes UTC-4 (EDT) first; falls back to UTC-5 (EST) if the date doesn't match.
function etMidnight(etDateStr) {
  const edt = new Date(etDateStr + 'T04:00:00Z')
  return edt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === etDateStr
    ? edt
    : new Date(etDateStr + 'T05:00:00Z')
}

// ─── Weekly Planner helpers ───────────────────────────────────────────────────

function getWeekStartDateStr(date = new Date()) {
  const etStr = getETDateStr(date)
  const d = new Date(etStr + 'T12:00:00Z') // noon UTC on ET date — unambiguous day-of-week
  const day = d.getUTCDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - daysToMonday)
  return getETDateStr(d)
}

function getNextMondayStr(fromDate = new Date()) {
  const etStr = getETDateStr(fromDate)
  const d = new Date(etStr + 'T12:00:00Z')
  const day = d.getUTCDay()
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  d.setUTCDate(d.getUTCDate() + daysUntil)
  return getETDateStr(d)
}

function getDayDate(weekStartDateStr, dayName) {
  const offsets = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }
  const d = new Date(weekStartDateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + (offsets[dayName] ?? 0))
  return getETDateStr(d)
}

// ─────────────────────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks = 0) {
  const todayET = getETDateStr()
  const d = new Date(todayET + 'T12:00:00Z')
  const dayOfWeek = d.getUTCDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setUTCDate(d.getUTCDate() - daysToMonday + offsetWeeks * 7)
  const mondayStr = getETDateStr(d)
  const sundayD = new Date(d)
  sundayD.setUTCDate(d.getUTCDate() + 6)
  const sundayStr = getETDateStr(sundayD)
  const start = etMidnight(mondayStr)
  const end = new Date(etMidnight(sundayStr).getTime() + 24 * 60 * 60 * 1000 - 1)
  // startStr / endStr let callers get the ET date string without calling toISOString()
  return { start, end, startStr: mondayStr, endStr: sundayStr }
}

function getMonthBoundsForWeek(offsetWeeks = 0) {
  const { startStr } = getWeekBounds(offsetWeeks)
  const [year, month] = startStr.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n) => String(n).padStart(2, '0')
  const monthStart = etMidnight(`${year}-${pad(month)}-01`)
  const monthEnd = new Date(etMidnight(`${year}-${pad(month)}-${pad(lastDay)}`).getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start: monthStart, end: monthEnd }
}

function countKpi(log, kpiDef, weekStart, weekEnd, monthStart, monthEnd) {
  const rangeStart = kpiDef.period === 'month' ? monthStart : weekStart
  const rangeEnd = kpiDef.period === 'month' ? monthEnd : weekEnd

  // (isRate KPIs are not part of the new input system and have been phased out
  //  but we guard just in case legacy data exists.)
  if (kpiDef.isRate) {
    const allVentures = log.filter((e) => {
      const d = new Date(e.completedAt)
      return d >= rangeStart && d <= rangeEnd && e.track === 'ventures' &&
        (e.completionType === 'Done' || e.completionType === 'Done + Outcome')
    })
    const dodUsed = allVentures.filter((e) => e.definitionOfDoneUsed)
    return { count: dodUsed.length, total: allVentures.length }
  }

  let count = 0
  for (const e of log) {
    const d = new Date(e.completedAt)
    if (d < rangeStart || d > rangeEnd) continue
    if (e.completionType === 'Partial' || e.completionType === 'Cancelled') continue

    // New kpiValues system: entry carries a dict of measured KPI values
    if (kpiDef.kpiValueId && e.kpiValues && e.kpiValues[kpiDef.kpiValueId] != null) {
      const val = e.kpiValues[kpiDef.kpiValueId]
      if (typeof val === 'number' && val > 0) count += val
      else if (val === true || (typeof val === 'string' && val.trim())) count += 1
      continue
    }

    // Legacy kpiMapping system: single kpiMapping string on the entry
    if (kpiDef.kpiMapping && e.kpiMapping === kpiDef.kpiMapping) {
      count += e.quantity ?? 1
    }
  }

  return { count, total: null }
}

/** Extra KPI counts from tagged personal/CoSA calendar events (Supabase calendar_event_tags). */
function countCalendarTagKpiCredits(tagsByEventId, kpiDef, weekStart, weekEnd, monthStart, monthEnd) {
  if (kpiDef.isRate || !kpiDef.kpiMapping) return 0
  const rangeStart = kpiDef.period === 'month' ? monthStart : weekStart
  const rangeEnd = kpiDef.period === 'month' ? monthEnd : weekEnd
  let count = 0
  for (const tag of Object.values(tagsByEventId)) {
    const credits = tag.kpiCredits
    if (!tag?.date || !Array.isArray(credits) || credits.length === 0) continue
    const tagDate = new Date(`${tag.date}T12:00:00`)
    if (tagDate < rangeStart || tagDate > rangeEnd) continue
    const qtyMap = tag.kpiQuantities && typeof tag.kpiQuantities === 'object' ? tag.kpiQuantities : {}
    for (const mapping of credits) {
      if (mapping !== kpiDef.kpiMapping) continue
      const q = qtyMap[mapping]
      count += typeof q === 'number' && q >= 1 ? q : 1
    }
  }
  return count
}

function isKpiHit(count, total, kpiDef) {
  if (kpiDef.isRate) return total > 0 && count === total
  if (!kpiDef.target) return count > 0
  return count >= kpiDef.target
}

function formatWeekLabel(weekStart, weekEnd) {
  const opts = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function calcMetrics(log, weekStart, weekEnd, trackFilter = null) {
  const entries = log.filter((e) => {
    const d = new Date(e.completedAt)
    if (d < weekStart || d > weekEnd) return false
    if (trackFilter && e.track !== trackFilter) return false
    return true
  })

  const completed = entries.filter(
    (e) => e.completionType === 'Done' || e.completionType === 'Done + Outcome',
  )

  const timeSavedSeconds = completed.reduce(
    (sum, e) => sum + Math.max(0, e.estimateSeconds - e.elapsedSeconds),
    0,
  )
  const overrunSeconds = completed.reduce(
    (sum, e) => sum + Math.max(0, e.elapsedSeconds - e.estimateSeconds),
    0,
  )
  const pauseCount = entries.reduce((sum, e) => sum + (e.pauseCount ?? 0), 0)
  const pauseDurationSeconds = entries.reduce((sum, e) => sum + (e.pauseDurationSeconds ?? 0), 0)
  const cancelledSeconds = entries
    .filter((e) => e.completionType === 'Cancelled')
    .reduce((sum, e) => sum + (e.cancelledSeconds ?? 0), 0)
  const total = entries.length
  const completedCount = completed.length
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : null

  return { timeSavedSeconds, overrunSeconds, pauseCount, pauseDurationSeconds, cancelledSeconds, completionRate, completedCount, total }
}

function getTomorrowDateString() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return getETDateStr(d)
}

function getTodayDateString() {
  return getETDateStr()
}

// Returns the logical "target" date for a deploy: today if it's a weekday, next Monday if weekend.
function getDeployTargetDate() {
  const todayStr = getTodayDateString()
  const d = new Date(todayStr + 'T12:00:00Z')
  const day = d.getUTCDay()
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1)       // Sunday → Monday
  else if (day === 6) d.setUTCDate(d.getUTCDate() + 2)  // Saturday → Monday
  return getETDateStr(d)
}

// Formats an ISO date string as "Monday, March 16"
function formatQueueDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Same localStorage merge as Calendar allocations editor (for Weekly Review vs Calendar parity). */
function loadMergedAllocationsForHealth() {
  if (typeof window === 'undefined') return { ...COSA_ALLOCATION_DEFAULTS }
  try {
    const raw = window.localStorage.getItem('cosa.allocations')
    let parsed = raw ? JSON.parse(raw) : null
    if (!parsed?.development) parsed = { ...COSA_ALLOCATION_DEFAULTS }
    if (parsed.networking) {
      const { networking: _rm, ...rest } = parsed
      parsed = rest
    }
    return parsed
  } catch {
    return { ...COSA_ALLOCATION_DEFAULTS }
  }
}

function wordsCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getTrackMeta(trackKey) {
  return Object.values(TRACKS).find((track) => track.key === trackKey)
}

// Maps a Google Calendar CoSA event → today_task_instance shape.
function gcalEventToTodayTask(ev) {
  const priv = ev.extendedProperties?.private ?? {}
  const startDT = ev.start?.dateTime
  const endDT   = ev.end?.dateTime
  const durationMin = startDT && endDT
    ? Math.round((new Date(endDT) - new Date(startDT)) / 60000)
    : 30
  return {
    id: `gcal-${ev.id}`,
    templateId: priv.cosaTemplateId ?? null,
    name: ev.summary ?? '(untitled)',
    track: priv.cosaTrack ?? 'advisors',
    subTrack: priv.cosaSubTrack ?? null,
    estimateMinutes: Math.max(5, durationMin),
    kpiMapping: '',
    calendarEventId: ev.id,
  }
}

function buildSessionsFromTodayTasks(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.id] = getInitialSession(task)
    return acc
  }, {})
}

function safeParseJSON(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const parsed = safeParseJSON(raw)
  if (!parsed || typeof parsed !== 'object') return null
  return parsed
}

function persistState(state) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function validateLibraryTask(task) {
  const errors = []
  if (!task.name?.trim()) errors.push('Name is required.')
  if (!Object.values(TRACKS).some((track) => track.key === task.track)) errors.push('Track is required.')
  if (!Number.isFinite(Number(task.defaultTimeEstimate)) || Number(task.defaultTimeEstimate) < 5) {
    errors.push('Default time estimate must be at least 5 minutes.')
  }
  if (!LIBRARY_STATUSES.includes(task.status)) errors.push('Status is required.')
  return errors
}

function getStatusBehavior(status) {
  if (status === 'Active') return 'Active tasks appear in the Task Library and are tracked in the queue.'
  if (status === 'Paused') return 'Paused tasks stay in the library but are excluded from the active queue.'
  return 'Archived tasks are kept for history but hidden from the active library.'
}

function getInitialSession(task) {
  const estimateSeconds = task.estimateMinutes * 60
  return {
    sessionId: crypto.randomUUID(),
    taskId: task.id,
    timerState: TIMER_STATES.notStarted,
    estimateSeconds,
    remainingSeconds: estimateSeconds,
    elapsedSeconds: 0,
    pauseCount: 0,
    pauseDurationSeconds: 0,
    currentPauseStartedAtMs: null,
    cancelledSeconds: 0,
    startedAtISO: null,
    definitionOfDone: '',
    actualCompleted: '',
    outcomeAchieved: null,
    completionLoggedAtISO: null,
  }
}

function SortableTaskRow({ task, session, trackMeta }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >
      <button
        type="button"
        className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: trackMeta?.color }} />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{task.name}</p>
        <p className="text-xs text-slate-500">{task.estimateMinutes}m · {session?.timerState}</p>
      </div>
    </li>
  )
}

function App() {
  const supabaseConfigured = isSupabaseConfigured()
  const bootstrap = useMemo(() => {
    const persisted = loadPersistedState()
    const library = Array.isArray(persisted?.taskLibrary)
      ? persisted.taskLibrary
      : INITIAL_TASK_LIBRARY
    // Only restore persisted tasks if they belong to today or a future pre-deploy date.
    // Stale tasks from a previous day are discarded so the queue starts clean.
    const today = (
      Array.isArray(persisted?.todayTasks) &&
      (persisted?.queueDate ?? '') >= getTodayDateString()
    ) ? persisted.todayTasks : []
    const sessionState =
      persisted?.sessions && typeof persisted.sessions === 'object'
        ? persisted.sessions
        : buildSessionsFromTodayTasks(today)

    return {
      taskLibrary: library,
      todayTasks: today,
      sessions: sessionState,
      activeTaskId: persisted?.activeTaskId ?? null,
      queueDate: persisted?.queueDate ?? getDeployTargetDate(),
    }
  }, [])

  const [activeScreen, setActiveScreen] = useState('today')
  const [taskLibrary, setTaskLibrary] = useState(bootstrap.taskLibrary)
  const [selectedLibraryTaskId, setSelectedLibraryTaskId] = useState(bootstrap.taskLibrary[0]?.id ?? null)
  const [todayTasks, setTodayTasks] = useState(bootstrap.todayTasks)
  const [activeTaskId, setActiveTaskId] = useState(bootstrap.activeTaskId)
  const [sessions, setSessions] = useState(bootstrap.sessions)
  const [completionInput, setCompletionInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [session, setSession] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [libraryMessage, setLibraryMessage] = useState('')
  const [librarySaveStatus, setLibrarySaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  // Subtasks live in their OWN state — never inside taskLibrary.
  // This means doSync / onAuthStateChange can never wipe them.
  const [subtasksMap, setSubtasksMap] = useState(() => loadSubtasksMap()) // { [taskId]: subtask[] }
  const [queueDate, setQueueDate] = useState(bootstrap.queueDate)
  const [libraryFilter, setLibraryFilter] = useState('Active')
  const [collapsedLibraryTracks, setCollapsedLibraryTracks] = useState({})
  const [archiveConfirmId, setArchiveConfirmId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [completionLog, setCompletionLog] = useState(() => loadCompletionLog())
  const [weekOffset, setWeekOffset] = useState(0)
  const [fridayReviews, setFridayReviews] = useState([])
  const [reviewDraft, setReviewDraft] = useState({ q1: '', q2: '', q3: '', mondayIntention: '' })
  const [reviewSaving, setReviewSaving] = useState(false)
  const [kpiDetail, setKpiDetail] = useState(null)
  const [gcalSyncStatus, setGcalSyncStatus] = useState(null) // null | 'syncing' | 'ok' | 'auth-error' | 'error'

  // ── App-ready gate: block render until Supabase sync completes ────────────
  // 'loading' → waiting for auth check or data sync
  // 'ready'   → show the app (either synced or not signed in)
  // 'error'   → sync failed, show retry screen
  const [syncStatus, setSyncStatus] = useState(() => supabaseConfigured ? 'loading' : 'ready')
  const [syncStep,   setSyncStep]   = useState('Connecting to your account…')
  const [syncError,  setSyncError]  = useState(null)
  const [syncTrigger, setSyncTrigger] = useState(0) // increment to force a re-sync
  const [kpiCreditVotes, setKpiCreditVotes] = useState({}) // templateId → boolean
  const [todayPreviewDate, setTodayPreviewDate] = useState(null)
  const [clearedDates, setClearedDates] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('cosa.clearedDates') ?? '[]') } catch { return [] }
  })
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [quickLogForm, setQuickLogForm] = useState({ who: '', activityType: '', track: '', subTrack: '', durationMinutes: null, kpiCredits: [], kpiQuantities: {}, note: '' })
  const [quickLogErrors, setQuickLogErrors] = useState({})
  const [quickLogSubmitting, setQuickLogSubmitting] = useState(false)
  const [quickLogToast, setQuickLogToast] = useState(false)
  // KPI values entered inline while the timer is running.
  // Structure: { [todayTaskId]: { [kpiInputId]: number | boolean | string | null } }
  // Persisted to localStorage so values survive page reloads before the task is completed.
  const [kpiSessionValues, setKpiSessionValues] = useState(() => {
    const persisted = loadPersistedState()
    return persisted?.kpiSessionValues ?? {}
  })
  // { [todayTaskId]: { [checkKey]: boolean } } — checkbox state for subtasks in Today Queue
  // checkKey is either subtaskId (plain subtask) or "subtaskId:itemId" (nested item)
  const [subtaskChecks, setSubtaskChecks] = useState({})
  // { [todayTaskId]: { [subtaskId]: boolean } } — which subtasks are expanded in Today Queue
  const [subtaskExpanded, setSubtaskExpanded] = useState({})
  const [quickLogEntries, setQuickLogEntries] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(QUICK_LOG_LOCAL_KEY) ?? '[]') } catch { return [] }
  })
  /** All GCal event id → tag row (including kpiCredits) for weekly KPI merge */
  const [calendarEventTags, setCalendarEventTags] = useState({})
  /** CoSA-tagged GCal events for the week shown on Weekly Review (matches Calendar → This Week). */
  const [reviewWeekCosaEvents, setReviewWeekCosaEvents] = useState([])
  const [showClearDayModal, setShowClearDayModal] = useState(false)
  const [clearFrom, setClearFrom] = useState(getTodayDateString())
  const [clearTo, setClearTo] = useState(getTodayDateString())
  const [showReconcileLog, setShowReconcileLog] = useState(false)
  const [reconcileExpandedTracks, setReconcileExpandedTracks] = useState({})
  const [reconcileEditId, setReconcileEditId] = useState(null)
  const [reconcileEditForm, setReconcileEditForm] = useState({})
  const [reconcileQlEditId, setReconcileQlEditId] = useState(null)
  const [reconcileQlEditForm, setReconcileQlEditForm] = useState({})
  const taskLibrarySyncTimer = useRef(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const effectiveSelectedLibraryTaskId = taskLibrary.some((task) => task.id === selectedLibraryTaskId)
    ? selectedLibraryTaskId
    : taskLibrary[0]?.id ?? null

  const activeTask = useMemo(
    () => todayTasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, todayTasks],
  )
  const activeSession = activeTask ? sessions[activeTask.id] : null
  const selectedLibraryTask = useMemo(
    () => taskLibrary.find((task) => task.id === effectiveSelectedLibraryTaskId) ?? null,
    [effectiveSelectedLibraryTaskId, taskLibrary],
  )

  const refreshCalendarEventTags = useCallback(async () => {
    if (!supabaseConfigured || !session?.user?.id) return
    const t = await loadCalendarEventTags(session.user.id)
    setCalendarEventTags(t)
  }, [session?.user?.id, supabaseConfigured])

  useEffect(() => {
    if (!session?.user?.id) setCalendarEventTags({})
  }, [session?.user?.id])

  // Weekly Review: load CoSA calendar blocks for the selected week (same math as Calendar sidebar).
  useEffect(() => {
    if (activeScreen !== 'kpi' || !session?.provider_token) return undefined
    let cancelled = false
    const { start, end } = getWeekBounds(weekOffset)
    const mondayLocal = formatLocalDate(start)
    const sundayLocal = formatLocalDate(end)
    const timeMin = new Date(`${mondayLocal}T00:00:00`).toISOString()
    const timeMax = new Date(`${sundayLocal}T23:59:59.999`).toISOString()
    ;(async () => {
      try {
        const allCosa = await fetchAllCalendarEvents(session.provider_token, timeMin, timeMax)
        if (cancelled) return
        const tagged = (allCosa ?? []).filter(
          (ev) => ev.extendedProperties?.private?.cosaTag === 'cosa-event',
        )
        setReviewWeekCosaEvents(tagged)
      } catch {
        if (!cancelled) setReviewWeekCosaEvents([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeScreen, weekOffset, session?.provider_token])

  useEffect(() => {
    if (!activeSession) return
    if (activeSession.timerState !== TIMER_STATES.running) return

    const tick = window.setInterval(() => {
      setSessions((prev) => {
        const current = prev[activeTask.id]
        if (!current) return prev
        if (
          current.timerState !== TIMER_STATES.running &&
          current.timerState !== TIMER_STATES.overrun
        ) {
          return prev
        }

        const nextElapsed = current.elapsedSeconds + 1
        const nextRemaining = Math.max(0, current.remainingSeconds - 1)

        return {
          ...prev,
          [activeTask.id]: {
            ...current,
            elapsedSeconds: nextElapsed,
            remainingSeconds: nextRemaining,
          },
        }
      })
    }, 1000)

    return () => window.clearInterval(tick)
  }, [activeSession, activeTask])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined

    let isMounted = true

    const hydrateSession = async () => {
      setSyncStep('Checking your session…')
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        setAuthMessage(`Unable to load session: ${error.message}`)
        setSyncStatus('ready') // show sign-in screen even on auth error
        return
      }
      const sess = data.session ?? null
      setSession(sess)
      if (!sess) {
        // Not signed in — show sign-in screen immediately, no sync needed
        setSyncStatus('ready')
      }
      // If signed in, the doSync useEffect will fire and set syncStatus → 'ready'
    }

    hydrateSession()

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setAuthMessage('')
      if (!newSession) {
        // Signed out — show sign-in screen immediately
        setSyncStatus('ready')
      } else if (event === 'SIGNED_IN') {
        // Fresh OAuth sign-in — show loading until doSync completes
        setSyncStatus('loading')
        setSyncStep('Signing in…')
      }
      // TOKEN_REFRESHED / USER_UPDATED etc. — don't interrupt an already-ready app
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [supabaseConfigured])

  async function handleGoogleLogin() {
    if (!supabaseConfigured || !supabase) {
      setAuthMessage('Supabase is not configured yet. Add VITE_SUPABASE_* values first.')
      return
    }

    setAuthBusy(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      setAuthMessage(`Google sign-in failed: ${error.message}`)
    }
    setAuthBusy(false)
  }

  async function handleSignOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthMessage(`Sign out failed: ${error.message}`)
      return
    }
    setSession(null)
  }

  // ── GCal sync helpers ─────────────────────────────────────────────────────

  /**
   * Merge GCal events for `dateStr` into the today queue.
   * - NEW events are appended.
   * - EXISTING events (matched by calendarEventId) are refreshed — name and
   *   duration are updated if GCal changed them since the last load.
   * Throws GCalAuthError if the token is expired/invalid so callers can react.
   */
  /**
   * @param {Record<string, object>} [sessionsForPrune] Optional map of task id → session used when
   *   pruning the queue (avoids stale React closure during sign-in doSync). Defaults to current `sessions`.
   */
  async function mergeGCalIntoQueue(currentTasks, dateStr, userId, sessionsForPrune = null) {
    const pruneMap = sessionsForPrune ?? sessions
    const { data: { session: liveSession } } = await supabase.auth.getSession()
    const providerToken = liveSession?.provider_token
    if (!providerToken) return

    // Use local-timezone midnight so events late in the evening aren't cut off
    // by a UTC day boundary (e.g. 9 pm EDT = 1 am UTC next day).
    const timeMin = new Date(`${dateStr}T00:00:00`).toISOString()
    const timeMax = new Date(`${dateStr}T23:59:59`).toISOString()

    // Build lookup: calendarEventId → task index in currentTasks
    const calIdToIdx = {}
    currentTasks.forEach((t, i) => { if (t.calendarEventId) calIdToIdx[t.calendarEventId] = i })

    let updatedTasks = [...currentTasks]
    let changed = false

    // Track every GCal event ID we confirm exists on today's calendar so we can
    // prune queue tasks that were calendar-backed but whose event was deleted.
    const todayGCalIds = new Set()

    // a) CoSA-tagged events — add new, refresh existing
    const cosaEvents = await fetchCoSACalendarEvents(providerToken, timeMin, timeMax)
    for (const ev of cosaEvents) {
      todayGCalIds.add(ev.id)
      const idx = calIdToIdx[ev.id]
      if (idx !== undefined) {
        // Refresh name / duration if GCal changed them
        const existing = updatedTasks[idx]
        const startDT = ev.start?.dateTime
        const endDT   = ev.end?.dateTime
        const durationMin = startDT && endDT
          ? Math.round((new Date(endDT) - new Date(startDT)) / 60000)
          : existing.estimateMinutes
        const newName = ev.summary ?? existing.name
        if (newName !== existing.name || durationMin !== existing.estimateMinutes) {
          updatedTasks[idx] = { ...existing, name: newName, estimateMinutes: Math.max(5, durationMin) }
          changed = true
        }
      } else {
        updatedTasks.push(gcalEventToTodayTask(ev))
        calIdToIdx[ev.id] = updatedTasks.length - 1
        changed = true
      }
    }

    // b) Personal tagged events — add new, refresh existing
    const allTags = await loadCalendarEventTags(userId)
    const todayTaggedIds = Object.entries(allTags)
      .filter(([, tag]) => tag.date === dateStr)
      .map(([gcalId]) => gcalId)

    if (todayTaggedIds.length > 0) {
      const personalEvents = await fetchPersonalCalendarEvents(providerToken, timeMin, timeMax)
      for (const ev of personalEvents) {
        const tag = allTags[ev.id]
        if (!tag) continue
        todayGCalIds.add(ev.id)
        const startDT = ev.start?.dateTime
        const endDT   = ev.end?.dateTime
        const durationMin = startDT && endDT
          ? Math.round((new Date(endDT) - new Date(startDT)) / 60000)
          : (tag.durationMin ?? 30)
        const idx = calIdToIdx[ev.id]
        if (idx !== undefined) {
          const existing = updatedTasks[idx]
          const newName = ev.summary ?? tag.title ?? existing.name
          if (newName !== existing.name || durationMin !== existing.estimateMinutes) {
            updatedTasks[idx] = { ...existing, name: newName, estimateMinutes: Math.max(5, durationMin) }
            changed = true
          }
        } else {
          updatedTasks.push({
            id: `gcal-${ev.id}`,
            templateId: null,
            name: ev.summary ?? tag.title ?? '(untitled)',
            track: tag.track,
            subTrack: tag.subTrack ?? null,
            estimateMinutes: Math.max(5, durationMin),
            kpiMapping: '',
            calendarEventId: ev.id,
          })
          calIdToIdx[ev.id] = updatedTasks.length - 1
          changed = true
        }
      }
    }

    // c) Prune tasks not backed by a GCal event today. The queue is calendar-driven:
    //    only tasks with a calendarEventId found in today's GCal events belong here.
    //    Exception: tasks with timer progress, completed, or cancelled are always kept.
    const prunedTasks = updatedTasks.filter((task) => {
      const sess = pruneMap[task.id]
      const hasProgress = sess && (
        sess.timerState !== TIMER_STATES.notStarted || (sess.elapsedSeconds ?? 0) > 0
      )
      const isFinished = sess && (
        sess.timerState === TIMER_STATES.completed || sess.timerState === TIMER_STATES.cancelled
      )
      if (isFinished) return true
      if (hasProgress) return true
      return task.calendarEventId && todayGCalIds.has(task.calendarEventId)
    })
    if (prunedTasks.length !== updatedTasks.length) {
      updatedTasks = prunedTasks
      changed = true
    }

    if (!changed) return

    setTodayTasks(updatedTasks)
    setQueueDate(dateStr)
    setSessions((prev) => {
      const next = { ...prev }
      updatedTasks.forEach((t) => { if (!next[t.id]) next[t.id] = getInitialSession(t) })
      return next
    })
    // Do not auto-select a task — user picks one explicitly from the queue.
    upsertTodayTasks(updatedTasks, userId, dateStr)
  }

  /** Manual "Sync from Calendar" button handler. */
  async function handleSyncFromGCal() {
    if (!session?.user?.id) return
    setGcalSyncStatus('syncing')
    try {
      await mergeGCalIntoQueue(todayTasks, getTodayDateString(), session.user.id)
      setGcalSyncStatus('ok')
      setTimeout(() => setGcalSyncStatus(null), 3000)
    } catch (err) {
      if (err instanceof GCalAuthError) {
        setGcalSyncStatus('auth-error')
      } else {
        console.error('[syncFromGCal]', err)
        setGcalSyncStatus('error')
        setTimeout(() => setGcalSyncStatus(null), 4000)
      }
    }
  }

  /**
   * Called by WeekPlanner when a new GCal event is created for today.
   * Immediately injects it into the Today queue without a full re-fetch.
   */
  function handleTodayEventCreated(gcalEvent) {
    if (!session?.user?.id) return
    const task = gcalEventToTodayTask(gcalEvent)
    setTodayTasks((prev) => {
      if (prev.some((t) => t.calendarEventId === gcalEvent.id)) return prev
      const next = [...prev, task]
      upsertTodayTasks(next, session.user.id, getTodayDateString())
      return next
    })
    setSessions((prev) => {
      if (prev[task.id]) return prev
      return { ...prev, [task.id]: getInitialSession(task) }
    })
    setQueueDate(getTodayDateString())
  }

  const tasksByTrack = useMemo(() => {
    // Dedup by calendarEventId only — prevents the same GCal event from
    // appearing twice if loaded via multiple fetch paths. Tasks with the
    // same name/template (e.g. two "Job Search Sprint" blocks) are kept
    // because they have distinct calendarEventIds.
    const seenCalIds = new Set()
    const deduped = []
    for (const t of todayTasks) {
      if (t.calendarEventId) {
        if (seenCalIds.has(t.calendarEventId)) continue
        seenCalIds.add(t.calendarEventId)
      }
      deduped.push(t)
    }
    // 2. Filter out completed/cancelled
    const active = deduped.filter((t) => {
      const s = sessions[t.id]
      return s?.timerState !== TIMER_STATES.completed && s?.timerState !== TIMER_STATES.cancelled
    })
    const trackOrder = Object.values(TRACKS).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    return trackOrder
      .map((track) => ({
        track,
        tasks: active.filter((t) => t.track === track.key),
      }))
      .filter((g) => g.tasks.length > 0)
  }, [todayTasks, sessions])
  const filteredTaskLibrary = useMemo(() => {
    if (libraryFilter === 'All') return taskLibrary
    return taskLibrary.filter((task) => task.status === libraryFilter)
  }, [libraryFilter, taskLibrary])

  // Set of library task template IDs that are currently in the active today queue.
  // Drives the "In Today" badge on library task cards.
  const deployedTemplateIds = useMemo(() => {
    if (!queueDate || queueDate < getTodayDateString()) return new Set()
    return new Set(todayTasks.map((t) => t.templateId).filter(Boolean))
  }, [todayTasks, queueDate])
  const libraryValidationMap = useMemo(
    () =>
      taskLibrary.reduce((acc, task) => {
        acc[task.id] = validateLibraryTask(task)
        return acc
      }, {}),
    [taskLibrary],
  )

  // Day-scroll helpers for Today Queue sidebar preview
  function formatScrollLabel(dateStr) {
    const today = getTodayDateString()
    if (dateStr === today) return 'Today'
    const tomorrowStr = getTomorrowDateString()
    const d = new Date(dateStr + 'T12:00:00')
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (dateStr === tomorrowStr) return `Tomorrow — ${label}`
    return label
  }

  function getWeekdayOffsetDate(baseStr, offsetDays) {
    const d = new Date(baseStr + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + offsetDays)
    return getETDateStr(d)
  }

  const previewScrollBase = todayPreviewDate ?? getTodayDateString()
  const weekScrollStart = getWeekStartDateStr()
  const weekScrollEnd = (() => {
    const d = new Date(weekScrollStart + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 4)
    return getETDateStr(d)
  })()

  function canScrollPrev() {
    return previewScrollBase > weekScrollStart
  }
  function canScrollNext() {
    return previewScrollBase < weekScrollEnd
  }
  function goToPrevDay() {
    let d = new Date(previewScrollBase + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 2)
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
    const next = getETDateStr(d)
    setTodayPreviewDate(next === getTodayDateString() ? null : next)
  }
  function goToNextDay() {
    let d = new Date(previewScrollBase + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2)
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1)
    const next = getETDateStr(d)
    setTodayPreviewDate(next)
  }

  const [previewTasks, setPreviewTasks] = useState(null)     // null = idle, [] = loaded but empty
  const [previewTasksLoading, setPreviewTasksLoading] = useState(false)

  useEffect(() => {
    if (!todayPreviewDate || !session?.user?.id || !supabaseConfigured) {
      setPreviewTasks(null)
      return
    }
    let cancelled = false
    setPreviewTasksLoading(true)

    async function fetchPreview() {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const providerToken = liveSession?.provider_token
      if (!providerToken || cancelled) { setPreviewTasksLoading(false); return }

      const timeMin = new Date(`${todayPreviewDate}T00:00:00`).toISOString()
      const timeMax = new Date(`${todayPreviewDate}T23:59:59`).toISOString()

      const tasks = []
      const seenIds = new Set()

      // CoSA-tagged calendar events
      try {
        const cosaEvents = await fetchCoSACalendarEvents(providerToken, timeMin, timeMax)
        for (const ev of cosaEvents) {
          if (seenIds.has(ev.id)) continue
          seenIds.add(ev.id)
          tasks.push(gcalEventToTodayTask(ev))
        }
      } catch {}

      // Personally-tagged events
      try {
        const allTags = await loadCalendarEventTags(session.user.id)
        const dayTaggedIds = Object.entries(allTags)
          .filter(([, tag]) => tag.date === todayPreviewDate)
          .map(([gcalId]) => gcalId)

        if (dayTaggedIds.length > 0) {
          const personalEvents = await fetchPersonalCalendarEvents(providerToken, timeMin, timeMax)
          for (const ev of personalEvents) {
            const tag = allTags[ev.id]
            if (!tag || seenIds.has(ev.id)) continue
            seenIds.add(ev.id)
            const durationMin = ev.start?.dateTime && ev.end?.dateTime
              ? Math.max(5, Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000))
              : (tag.durationMin ?? 30)
            tasks.push({
              id: `gcal-${ev.id}`,
              templateId: null,
              name: ev.summary ?? tag.title ?? '(untitled)',
              track: tag.track,
              subTrack: tag.subTrack ?? null,
              estimateMinutes: durationMin,
              calendarEventId: ev.id,
            })
          }
        }
      } catch {}

      if (!cancelled) {
        setPreviewTasks(tasks)
        setPreviewTasksLoading(false)
      }
    }

    fetchPreview().catch(() => { if (!cancelled) setPreviewTasksLoading(false) })
    return () => { cancelled = true }
  }, [todayPreviewDate, session?.user?.id])

  const kpiSummary = useMemo(() => {
    const { start: ws, end: we } = getWeekBounds(weekOffset)
    const { start: ms, end: me } = getMonthBoundsForWeek(weekOffset)
    const results = KPI_DEFINITIONS.map((def) => {
      const { count: logCount, total } = countKpi(completionLog, def, ws, we, ms, me)
      const calCount = countCalendarTagKpiCredits(calendarEventTags, def, ws, we, ms, me)
      const count = logCount + calCount
      return { ...def, count, total, hit: isKpiHit(count, total, def) }
    })
    const weekly = results.filter(
      (k) => !k.isRate && k.period === 'week' && k.target && k.countsTowardWeekScore !== false,
    )
    const hit = weekly.filter((k) => k.hit).length
    const score = hit >= 7 ? 'green' : hit >= 4 ? 'yellow' : 'red'
    return { kpisHit: hit, kpisTotal: weekly.length, weekScore: score, kpiResults: results }
  }, [completionLog, calendarEventTags, weekOffset])

  const hasLockedTodayTimers = useMemo(
    () =>
      Object.values(sessions).some((sessionItem) =>
        [TIMER_STATES.running, TIMER_STATES.paused, TIMER_STATES.overrun].includes(
          sessionItem.timerState,
        ),
      ),
    [sessions],
  )

  useEffect(() => {
    persistState({
      taskLibrary,
      todayTasks,
      sessions,
      activeTaskId,
      queueDate,
      kpiSessionValues,
    })
  }, [activeTaskId, kpiSessionValues, queueDate, sessions, taskLibrary, todayTasks])

  useEffect(() => {
    saveCompletionLog(completionLog)
  }, [completionLog])

  // ── Sign-in: load all state from Supabase (single source of truth) ──────
  // syncTrigger is incremented by the "Try again" retry button.
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    const todayStr = getTodayDateString()
    const targetStr = getDeployTargetDate()

    const doSync = async () => {
      setSyncStatus('loading')
      setSyncError(null)

      try {
        // ── 1. Task library ──────────────────────────────────────────────────
        setSyncStep('Loading task library…')
        let activeLibrary = taskLibrary
        const remoteLibrary = await loadTaskTemplates(userId)
        if (remoteLibrary && remoteLibrary.length > 0) {
          const merged = mergeSubtasksIntoLibrary(remoteLibrary)
          setTaskLibrary(merged)
          activeLibrary = merged
        } else {
          upsertTaskTemplates(taskLibrary, userId)
        }

        // ── 2. Today's queue + active timer states ───────────────────────────
        setSyncStep('Loading today\'s queue…')
        let effectiveTodayTasks = []
        let signInSessionsSnapshot = null

        const remoteTodayTasks = await loadTodayTasks(userId, targetStr)
        if (remoteTodayTasks && remoteTodayTasks.length > 0) {
          effectiveTodayTasks = remoteTodayTasks
          const taskById = Object.fromEntries(remoteTodayTasks.map((t) => [t.id, t]))
          signInSessionsSnapshot = {}
          remoteTodayTasks.forEach((task) => {
            signInSessionsSnapshot[task.id] = getInitialSession(task)
          })
          const taskIds = remoteTodayTasks.map((t) => t.id)
          const remoteTimerSessions = await loadTodayTimerSessions(userId, taskIds)
          if (remoteTimerSessions) {
            remoteTimerSessions.forEach((rs) => {
              const tid = rs.taskId
              if (!tid || !taskById[tid]) return
              signInSessionsSnapshot[tid] = {
                ...(signInSessionsSnapshot[tid] ?? getInitialSession(taskById[tid])),
                ...rs,
              }
            })
          }

          setTodayTasks(remoteTodayTasks)
          setQueueDate(targetStr)
          setSessions((prev) => {
            const next = { ...prev }
            const TERMINAL = [TIMER_STATES.completed, TIMER_STATES.cancelled]
            for (const task of remoteTodayTasks) {
              const remoteSnap = signInSessionsSnapshot[task.id]
              const localSnap  = prev[task.id]
              if (remoteSnap && remoteSnap.timerState !== TIMER_STATES.notStarted) {
                // upsertTimerSession is only called at state transitions (start/pause/complete),
                // not every tick — so the remote elapsedSeconds can be minutes behind the live
                // local counter. If local is ahead, preserve its elapsed/remaining so a
                // running timer survives an OAuth re-auth without resetting.
                const localAhead =
                  localSnap &&
                  !TERMINAL.includes(localSnap.timerState) &&
                  (localSnap.elapsedSeconds ?? 0) > (remoteSnap.elapsedSeconds ?? 0)
                next[task.id] = localAhead
                  ? { ...remoteSnap, elapsedSeconds: localSnap.elapsedSeconds, remainingSeconds: localSnap.remainingSeconds }
                  : remoteSnap
              } else if (localSnap && TERMINAL.includes(localSnap.timerState)) {
                next[task.id] = localSnap
              } else {
                next[task.id] = remoteSnap ?? getInitialSession(task)
              }
            }
            return next
          })
        }

        // ── 3. User preferences (cleared dates, allocations, subtask checks) ──
        setSyncStep('Loading your preferences…')
        const prefs = await loadUserPreferences(userId)
        if (prefs?.cleared_dates) {
          setClearedDates(prefs.cleared_dates)
          window.localStorage.setItem('cosa.clearedDates', JSON.stringify(prefs.cleared_dates))
        }
        if (prefs?.allocations && typeof prefs.allocations === 'object') {
          try { window.localStorage.setItem('cosa.allocations', JSON.stringify(prefs.allocations)) } catch {}
        }
        if (prefs?.subtask_checks && typeof prefs.subtask_checks === 'object') {
          setSubtaskChecks(prefs.subtask_checks)
        }

        // ── 4. Calendar sync (non-fatal — auth errors shown inline) ──────────
        setSyncStep('Syncing calendar…')
        try {
          await mergeGCalIntoQueue(effectiveTodayTasks, todayStr, userId, signInSessionsSnapshot)
        } catch (err) {
          if (err instanceof GCalAuthError) setGcalSyncStatus('auth-error')
          else console.error('[sign-in GCal merge]', err)
        }

        // ── 5. Completion log (90 days of timer sessions) ────────────────────
        setSyncStep('Loading your activity log…')
        const remoteSessions = await loadTimerSessions(userId)
        if (remoteSessions && remoteSessions.length > 0) {
          // Supabase is the source of truth.
          // localOnly keeps any UUID entry whose Supabase insert failed (not in remoteIds,
          // not a legacy ql- entry) so it stays visible until a future sync persists it.
          // ql- entries are legacy cache artifacts — new quick logs use real UUIDs.
          setCompletionLog((prev) => {
            const remoteIds = new Set(remoteSessions.map((s) => s.id))
            const localOnly = prev.filter(
              (e) => !remoteIds.has(e.id) && !String(e.id).startsWith('ql-'),
            )
            return [...remoteSessions, ...localOnly]
          })
        }
        // If remoteSessions is null or empty we leave the local log untouched —
        // a failed/empty Supabase response must never wipe data the user can see.

        // ── 6. Weekly reviews ────────────────────────────────────────────────
        setSyncStep('Loading weekly reviews…')
        const reviews = await loadFridayReviews(userId)
        setFridayReviews(reviews)

        // ── 7. Quick log entries ─────────────────────────────────────────────
        // Also used as a fallback: if a quick log's timer_sessions insert ever
        // failed (historically due to task_instance_id NOT NULL constraint),
        // the entry still exists in quick_log_entries. We synthesise completion
        // log rows from it so time bars and KPI counts always reflect all logs.
        setSyncStep('Loading quick log entries…')
        const { start: qlStart, end: qlEnd } = getWeekBounds(0)
        const qlEntries = await loadQuickLogEntries(qlStart.toISOString(), qlEnd.toISOString(), userId)
        setQuickLogEntries(qlEntries)

        if (qlEntries.length > 0) {
          setCompletionLog((prev) => {
            // Build a lookup of timestamps already covered by quick-log timer_sessions
            const remoteQlTimes = prev
              .filter((e) => e.isQuickLog)
              .map((e) => new Date(e.completedAt).getTime())

            const synthetic = []
            for (const ql of qlEntries) {
              const qlTime = new Date(ql.logged_at).getTime()
              // Skip if a matching timer_session already exists (±60 s window)
              const alreadySynced = remoteQlTimes.some((t) => Math.abs(t - qlTime) <= 60_000)
              if (alreadySynced) continue

              const elapsedSeconds = (ql.duration_minutes ?? 0) * 60
              const kpis = Array.isArray(ql.kpi_credits) ? ql.kpi_credits : []
              if (kpis.length > 0) {
                kpis.forEach((mapping) => {
                  synthetic.push({
                    id: `ql-fallback-${ql.id}-${mapping}`,
                    taskName: `Quick Log: ${ql.activity_type} with ${ql.who}`,
                    track: KPI_LABEL_TO_TRACK[mapping] ?? ql.track ?? 'advisors',
                    kpiMapping: mapping,
                    quantity: 1,
                    completedAt: ql.logged_at,
                    elapsedSeconds,
                    isQuickLog: true,
                  })
                })
              } else {
                synthetic.push({
                  id: `ql-fallback-${ql.id}`,
                  taskName: `Quick Log: ${ql.activity_type} with ${ql.who}`,
                  track: ql.track ?? 'advisors',
                  kpiMapping: null,
                  quantity: 1,
                  completedAt: ql.logged_at,
                  elapsedSeconds,
                  isQuickLog: true,
                })
              }
            }
            return synthetic.length > 0 ? [...prev, ...synthetic] : prev
          })
        }

        // ── 8. Calendar event tags ───────────────────────────────────────────
        setSyncStep('Loading calendar tags…')
        const calTags = await loadCalendarEventTags(userId)
        setCalendarEventTags(calTags)

        // All done — release the loading gate
        setSyncStatus('ready')
      } catch (err) {
        console.error('[doSync]', err)
        setSyncError(err?.message || 'Something went wrong loading your data.')
        setSyncStatus('error')
      }
    }

    doSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, supabaseConfigured, syncTrigger])

  // ── Re-fetch activity log whenever the KPI screen is opened ─────────────
  // This ensures data logged on another device is always current without
  // requiring a full page reload. Also applies the quick_log_entries fallback
  // so time bars reflect logs even if their timer_sessions inserts failed.
  useEffect(() => {
    if (activeScreen !== 'kpi' || !supabaseConfigured || !session?.user?.id) return
    const userId = session.user.id
    ;(async () => {
      try {
        const [remoteSessions, qlEntries] = await Promise.all([
          loadTimerSessions(userId),
          loadQuickLogEntries(...(() => { const { start, end } = getWeekBounds(0); return [start.toISOString(), end.toISOString(), userId] })()),
        ])

        setQuickLogEntries(qlEntries)

        setCompletionLog((prev) => {
          // Merge remote timer_sessions
          let next = prev
          if (remoteSessions && remoteSessions.length > 0) {
            const remoteIds = new Set(remoteSessions.map((s) => s.id))
            const localOnly = prev.filter(
              (e) => !remoteIds.has(e.id) && !String(e.id).startsWith('ql-'),
            )
            next = [...remoteSessions, ...localOnly]
          }

          // Fallback: synthesise entries from quick_log_entries missing in timer_sessions
          if (qlEntries.length > 0) {
            const remoteQlTimes = next.filter((e) => e.isQuickLog).map((e) => new Date(e.completedAt).getTime())
            const synthetic = []
            for (const ql of qlEntries) {
              const qlTime = new Date(ql.logged_at).getTime()
              if (remoteQlTimes.some((t) => Math.abs(t - qlTime) <= 60_000)) continue
              const elapsedSeconds = (ql.duration_minutes ?? 0) * 60
              const kpis = Array.isArray(ql.kpi_credits) ? ql.kpi_credits : []
              if (kpis.length > 0) {
                kpis.forEach((mapping) => synthetic.push({
                  id: `ql-fallback-${ql.id}-${mapping}`,
                  taskName: `Quick Log: ${ql.activity_type} with ${ql.who}`,
                  track: KPI_LABEL_TO_TRACK[mapping] ?? ql.track ?? 'advisors',
                  kpiMapping: mapping,
                  quantity: 1,
                  completedAt: ql.logged_at,
                  elapsedSeconds,
                  isQuickLog: true,
                }))
              } else {
                synthetic.push({
                  id: `ql-fallback-${ql.id}`,
                  taskName: `Quick Log: ${ql.activity_type} with ${ql.who}`,
                  track: ql.track ?? 'advisors',
                  kpiMapping: null,
                  quantity: 1,
                  completedAt: ql.logged_at,
                  elapsedSeconds,
                  isQuickLog: true,
                })
              }
            }
            if (synthetic.length > 0) next = [...next, ...synthetic]
          }

          return next
        })
      } catch (err) {
        console.error('[kpi screen log refresh]', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen, session?.user?.id, supabaseConfigured])

  // ── Sync task library edits to Supabase (debounced 500ms) ────────────────
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    clearTimeout(taskLibrarySyncTimer.current)
    taskLibrarySyncTimer.current = setTimeout(() => {
      upsertTaskTemplates(taskLibrary, userId)
    }, 500)
    return () => clearTimeout(taskLibrarySyncTimer.current)
  }, [taskLibrary, session?.user?.id, supabaseConfigured])

  // ── Sync subtask check state to Supabase (debounced 800ms) ───────────────
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    const t = setTimeout(() => {
      upsertUserPreferences({ subtask_checks: subtaskChecks }, userId)
    }, 800)
    return () => clearTimeout(t)
  }, [subtaskChecks, session?.user?.id, supabaseConfigured])

  // ── Load current week's review into draft when week changes ─────────────
  useEffect(() => {
    const weekStartStr = getWeekBounds(weekOffset).startStr
    const existing = fridayReviews.find((r) => r.week_start === weekStartStr)
    setReviewDraft({
      q1: existing?.q1 ?? '',
      q2: existing?.q2 ?? '',
      q3: existing?.q3 ?? '',
      mondayIntention: existing?.monday_intention ?? '',
    })
  }, [weekOffset, fridayReviews])

  function updateLibraryTask(taskId, field, value) {
    if (field === 'subtasks') {
      // Subtasks live entirely in subtasksMap — never in taskLibrary.
      // This means doSync / token-refresh can never touch them.
      const subtasks = Array.isArray(value) ? value : []
      setSubtasksMap((prev) => {
        const next = { ...prev, [taskId]: subtasks }
        saveSubtasksMap(next)
        return next
      })
    } else {
      setTaskLibrary((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)),
      )
    }
  }

  async function saveLibraryTask() {
    if (!selectedLibraryTask) return
    setLibrarySaveStatus('saving')

    const t = selectedLibraryTask
    const subtasks = subtasksMap[t.id] ?? []

    // 1. Always save subtasks to dedicated localStorage key — guaranteed to work.
    const map = loadSubtasksMap()
    map[t.id] = subtasks
    saveSubtasksMap(map)

    // 2. Attempt Supabase upsert — best effort (silent fail is OK because
    //    localStorage is the source of truth for subtasks).
    if (session?.user?.id && supabase) {
      try {
        const row = {
          id: t.id,
          user_id: session.user.id,
          name: t.name ?? '',
          track: t.track ?? 'advisors',
          sub_track: t.subTrack ?? null,
          default_estimate_minutes: t.defaultTimeEstimate ?? 25,
          kpi_mapping: t.kpiMapping ?? '',
          status: t.status ?? 'Active',
          subtasks,
          updated_at: new Date().toISOString(),
        }
        const { error } = await supabase.from('task_templates').upsert(row, { onConflict: 'id' })
        if (error) console.warn('[saveLibraryTask] Supabase subtasks write failed (will use localStorage):', error.message)
      } catch (err) {
        console.warn('[saveLibraryTask] Supabase error (will use localStorage):', err.message)
      }
    }

    setLibrarySaveStatus('saved')
    setTimeout(() => setLibrarySaveStatus(null), 2500)
  }

  function archiveLibraryTask(taskId) {
    setTaskLibrary((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: 'Archived' } : task)),
    )
    setSelectedLibraryTaskId(null)
    setLibraryMessage('Task archived and removed from active library.')
    setArchiveConfirmId(null)
  }

  async function deleteLibraryTask(taskId) {
    setTaskLibrary((prev) => prev.filter((task) => task.id !== taskId))
    setSubtasksMap((prev) => { const next = { ...prev }; delete next[taskId]; return next })
    setSelectedLibraryTaskId(null)
    setDeleteConfirmId(null)
    setLibraryMessage('Task permanently deleted.')

    if (supabaseConfigured && session?.user?.id) {
      try {
        const { error } = await supabase
          .from('task_templates')
          .delete()
          .eq('id', taskId)
          .eq('user_id', session.user.id)
        if (error) console.warn('[deleteLibraryTask]', error.message)
      } catch (err) {
        console.warn('[deleteLibraryTask]', err)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  function createLibraryTask() {
    const nextId = `lib-${Date.now()}`
    const nextTask = {
      id: nextId,
      name: 'New Task',
      track: TRACKS.advisors.key,
      subTrack: null,
      defaultTimeEstimate: 25,
      kpiMapping: '',
      status: 'Active',
      subtasks: [],
    }
    setTaskLibrary((prev) => [nextTask, ...prev])
    setSelectedLibraryTaskId(nextId)
    setLibraryMessage('New task created.')
  }

  function setActiveTask(taskId) {
    const selectedSession = sessions[taskId]
    if (!selectedSession) return
    setActiveTaskId(taskId)
    setStatusMessage('')
    setCompletionInput(selectedSession.actualCompleted ?? '')
  }

  function handleStart() {
    if (!activeTask || !activeSession) return
    setStatusMessage('')
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta = current.currentPauseStartedAtMs
      ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
      : 0

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.running,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      startedAtISO: current.startedAtISO ?? new Date().toISOString(),
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }
  }

  function handlePause() {
    if (!activeTask || !activeSession) return
    if (activeSession.timerState !== TIMER_STATES.running) return

    const current = sessions[activeTask.id]
    if (!current) return

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.paused,
      pauseCount: current.pauseCount + 1,
      currentPauseStartedAtMs: Date.now(),
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }
  }

  function handleCancel() {
    if (!activeTask || !activeSession) return
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    const now = new Date().toISOString()
    const nextSession = {
      ...current,
      timerState: TIMER_STATES.cancelled,
      completionType: 'Cancelled',
      cancelledSeconds: current.remainingSeconds,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))

    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      subTrack: activeTask.subTrack ?? '',
      kpiMapping: activeTask.kpiMapping ?? '',
      kpiValues: kpiSessionValues[activeTask.id] ?? {},
      completionType: 'Cancelled',
      outcomeAchieved: null,
      definitionOfDoneUsed: false,
      completedAt: now,
      estimateSeconds: current.estimateSeconds,
      elapsedSeconds: current.elapsedSeconds,
      pauseCount: current.pauseCount,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      cancelledSeconds: current.remainingSeconds,
    }
    setCompletionLog((prev) => [...prev, logEntry])
    setKpiSessionValues((prev) => { const next = { ...prev }; delete next[activeTask.id]; return next })

    setStatusMessage('Task cancelled.')
  }

  function handleComplete() {
    if (!activeTask || !activeSession) return
    handleCompleteTask(activeTask.id)
  }

  /** Complete the active task and credit the full time estimate regardless of elapsed. */
  function handleFullCredit() {
    if (!activeTask || !activeSession) return
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    const fullSeconds = current.estimateSeconds ?? activeTask.estimateMinutes * 60
    const now = new Date().toISOString()
    const completionType = current.outcomeAchieved != null ? 'Done + Outcome' : 'Done'
    const kpiValues = kpiSessionValues[activeTask.id] ?? {}

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.completed,
      completionType,
      actualCompleted: completionInput.trim() || '(full credit)',
      elapsedSeconds: fullSeconds,
      pauseDurationSeconds: (current.pauseDurationSeconds ?? 0) + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
      quantity: 1,
      kpiValues,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      subTrack: activeTask.subTrack ?? '',
      kpiMapping: activeTask.kpiMapping ?? '',
      kpiValues,
      completionType,
      quantity: 1,
      completedAt: now,
      estimateSeconds: fullSeconds,
      elapsedSeconds: fullSeconds,
      pauseDurationSeconds: (current.pauseDurationSeconds ?? 0) + Math.max(0, pauseDelta),
      cancelledSeconds: 0,
    }
    setCompletionLog((prev) => [...prev, logEntry])
    setKpiSessionValues((prev) => { const next = { ...prev }; delete next[activeTask.id]; return next })
    setStatusMessage(`"${activeTask.name}" — full ${Math.round(fullSeconds / 60)}m credited.`)
  }

  function handleCompleteTask(taskId) {
    const task = todayTasks.find((t) => t.id === taskId)
    const current = sessions[taskId]
    if (!task || !current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    // If the timer was never started, credit the full estimate as elapsed
    const elapsedSeconds = current.elapsedSeconds > 0
      ? current.elapsedSeconds
      : (current.estimateSeconds ?? task.estimateMinutes * 60)

    const now = new Date().toISOString()
    const completionType = current.outcomeAchieved != null ? 'Done + Outcome' : 'Done'
    const kpiValues = kpiSessionValues[taskId] ?? {}

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.completed,
      completionType,
      actualCompleted: current.timerState === TIMER_STATES.notStarted ? '(logged complete)' : (completionInput.trim() || ''),
      elapsedSeconds,
      pauseDurationSeconds: (current.pauseDurationSeconds ?? 0) + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
      quantity: 1,
      kpiValues,
    }

    setSessions((prev) => ({ ...prev, [taskId]: nextSession }))

    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, task, session.user.id)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: task.name,
      track: task.track,
      subTrack: task.subTrack ?? '',
      kpiMapping: task.kpiMapping ?? '',
      kpiValues,
      completionType,
      quantity: 1,
      completedAt: now,
      estimateSeconds: current.estimateSeconds,
      elapsedSeconds,
      pauseDurationSeconds: (current.pauseDurationSeconds ?? 0) + Math.max(0, pauseDelta),
      cancelledSeconds: 0,
    }
    setCompletionLog((prev) => [...prev, logEntry])
    setKpiSessionValues((prev) => { const next = { ...prev }; delete next[taskId]; return next })
    setStatusMessage(`"${task.name}" marked complete.`)

  }

  async function handleSaveFridayReview() {
    const weekStartStr = getWeekBounds(weekOffset).startStr
    const record = {
      week_start: weekStartStr,
      week_score: kpiSummary.weekScore,
      kpis_hit: kpiSummary.kpisHit,
      kpis_total: kpiSummary.kpisTotal,
      q1: reviewDraft.q1,
      q2: reviewDraft.q2,
      q3: reviewDraft.q3,
      monday_intention: reviewDraft.mondayIntention,
    }
    setReviewSaving(true)
    if (supabaseConfigured && session?.user?.id) {
      await upsertFridayReview(record, session.user.id)
      const updated = await loadFridayReviews(session.user.id)
      setFridayReviews(updated)
    } else {
      setFridayReviews((prev) => {
        const filtered = prev.filter((r) => r.week_start !== weekStartStr)
        return [{ ...record, id: `local-${weekStartStr}` }, ...filtered]
      })
    }
    setReviewSaving(false)
  }

  // handlePrintReview and handlePrintPastReview are defined inside
  // renderKpiDashboard so they can access the locally-computed timeByTrack.

  // ── Clear Day handlers ────────────────────────────────────────────────────

  async function handleConfirmClearDay() {
    const from = new Date(clearFrom + 'T12:00:00Z')
    const to = new Date(clearTo + 'T12:00:00Z')
    const dates = []
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(getETDateStr(d))
    }

    const next = [...new Set([...clearedDates, ...dates])]
    setClearedDates(next)
    window.localStorage.setItem('cosa.clearedDates', JSON.stringify(next))

    // Clear today's tasks if today is in the range
    if (dates.includes(getTodayDateString())) {
      setTodayTasks([])
      setSessions({})
      setActiveTaskId(null)
    }

    if (session?.user?.id) {
      await upsertUserPreferences({ cleared_dates: next }, session.user.id)
    }

    setShowClearDayModal(false)
    setClearFrom(getTodayDateString())
    setClearTo(getTodayDateString())
  }

  // ── Week Ahead handlers ───────────────────────────────────────────────────

  async function handleGenerateWeekPlan() {
    setWeekPlanLoading(true)
    setWeekPlanMessage('')
    setShowAiRationale(false)

    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Sun, 1=Mon … 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFridayGen = dayOfWeek === 5
    const planWeekStartDate = isWeekend || isFridayGen
      ? getNextMondayStr()
      : getWeekStartDateStr()

    try {
      const ALL_PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const planDayNames = (isWeekend || isFridayGen)
        ? ALL_PLAN_DAYS
        : ALL_PLAN_DAYS.slice(Math.max(0, dayOfWeek - 1))
      const hydratedDays = {}

      for (const dayName of planDayNames) {
        const dayTasks = taskLibrary
          .filter((t) => t.status === 'Active')
          .map((t) => ({
            templateId:      t.id,
            name:            t.name,
            track:           t.track,
            estimateMinutes: t.defaultTimeEstimate ?? 25,
            gcalEventId:     null,
            status:          'planned',
          }))

        hydratedDays[dayName] = {
          date:  getDayDate(planWeekStartDate, dayName),
          tasks: dayTasks,
        }
      }

      const totalTasks = Object.values(hydratedDays).reduce((n, d) => n + d.tasks.length, 0)
      const dayRange = planDayNames.length === 5
        ? `week of ${planWeekStartDate}`
        : `${planDayNames[0]}–Friday of week of ${planWeekStartDate}`
      const aiRationale = JSON.stringify({
        summary: `${totalTasks} tasks scheduled for ${dayRange}.`,
        note: 'Review the plan, adjust as needed, then click Publish to Calendar.',
      })

      const newPlan = {
        status:        'draft',
        weekStartDate: planWeekStartDate,
        generatedAt:   new Date().toISOString(),
        aiRationale,
        days:          hydratedDays,
      }

      const planId = session?.user?.id
        ? await upsertWeeklyPlan(newPlan, planWeekStartDate, session.user.id)
        : null

      setWeekPlan({ ...newPlan, id: planId })
    } catch (err) {
      setWeekPlanMessage(`Failed to generate plan: ${err.message}`)
    } finally {
      setWeekPlanLoading(false)
    }
  }

  function handleRemoveTaskFromDraft(dayName, taskIndex) {
    setWeekPlan((prev) => {
      if (!prev) return prev
      const updatedTasks = (prev.days[dayName]?.tasks ?? []).filter((_, i) => i !== taskIndex)
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayName]: { ...prev.days[dayName], tasks: updatedTasks },
        },
      }
    })
  }

  function handleReplanWeekFromToday() {
    setActiveScreen('weekPlanner')
  }

  // ─── Quick Log ────────────────────────────────────────────────────────────

  function openQuickLog() {
    setQuickLogForm({ who: '', activityType: '', track: '', subTrack: '', durationMinutes: null, kpiCredits: [], kpiQuantities: {}, note: '' })
    setQuickLogErrors({})
    setShowQuickLog(true)
  }

  async function handleQuickLogSubmit() {
    const errors = {}
    if (!quickLogForm.who.trim()) errors.who = 'Required'
    if (!quickLogForm.activityType) errors.activityType = 'Required'
    if (!quickLogForm.track) errors.track = 'Required'
    if (!quickLogForm.durationMinutes) errors.durationMinutes = 'Required'
    // KPI credits are optional — time can be logged without hitting a KPI
    if (Object.keys(errors).length > 0) { setQuickLogErrors(errors); return }

    setQuickLogSubmitting(true)
    const now = new Date().toISOString()
    const elapsedSeconds = quickLogForm.durationMinutes * 60
    const note = quickLogForm.note.trim() || `Quick log: ${quickLogForm.activityType} with ${quickLogForm.who}`

    // Determine unique tracks from selected KPIs
    const tracks = [...new Set(quickLogForm.kpiCredits.map((k) => KPI_LABEL_TO_TRACK[k]).filter(Boolean))]

    const baseEntry = {
      taskName: `Quick Log: ${quickLogForm.activityType} with ${quickLogForm.who}`,
      outcomeAchieved: true,
      definitionOfDoneUsed: false,
      completedAt: now,
      estimateSeconds: elapsedSeconds,
      elapsedSeconds,
      pauseCount: 0,
      pauseDurationSeconds: 0,
      cancelledSeconds: 0,
      isQuickLog: true,
    }

    // Generate stable UUIDs upfront — the SAME id is used for both the local
    // completionLog entry and the Supabase timer_sessions row so they can be
    // reconciled correctly on reload without data loss if the insert fails.
    const kpiMappingsToSave = quickLogForm.kpiCredits.length > 0
      ? quickLogForm.kpiCredits.map((mapping) => ({
          id: crypto.randomUUID(),
          track: KPI_LABEL_TO_TRACK[mapping] ?? tracks[0] ?? quickLogForm.track,
          kpi_mapping: mapping,
          quantity: quickLogForm.kpiQuantities[mapping] ?? 1,
        }))
      : [{ id: crypto.randomUUID(), track: quickLogForm.track, kpi_mapping: null, quantity: 1 }]

    // Build one completion log entry per KPI using the pre-generated UUID
    const newLogEntries = kpiMappingsToSave.map(({ id, track, kpi_mapping, quantity }) => ({
      ...baseEntry,
      id,
      track,
      kpiMapping: kpi_mapping,
      quantity,
    }))

    // Update completion log immediately (KPI dashboard reacts instantly)
    setCompletionLog((prev) => [...prev, ...newLogEntries])

    // Save to Supabase if signed in
    if (supabaseConfigured && supabase && session?.user?.id) {
      const userId = session.user.id

      // 1. Save quick_log_entries record
      await upsertQuickLogEntry(
        {
          who: quickLogForm.who.trim(),
          activityType: quickLogForm.activityType,
          track: quickLogForm.track,
          subTrack: quickLogForm.subTrack.trim() || null,
          durationMinutes: quickLogForm.durationMinutes,
          kpiCredits: quickLogForm.kpiCredits,
          note: quickLogForm.note.trim() || null,
        },
        userId,
      )

      // 2. One timer_sessions row per KPI using the same UUID as the local entry
      let anyInsertFailed = false
      for (const { id, track, kpi_mapping, quantity } of kpiMappingsToSave) {
        const row = {
          id,
          user_id: userId,
          task_instance_id: null,
          task_name: `Quick Log: ${quickLogForm.activityType} with ${quickLogForm.who}`,
          track,
          sub_track: quickLogForm.subTrack.trim() || '',
          kpi_mapping,
          quantity,
          timer_state: 'Completed',
          completion_type: 'Done',
          estimate_seconds: elapsedSeconds,
          elapsed_seconds: elapsedSeconds,
          pause_count: 0,
          pause_duration_seconds: 0,
          overrun_seconds: 0,
          cancelled_seconds: 0,
          outcome_achieved: true,
          definition_of_done: '',
          actual_completed: '',
          started_at: null,
          completed_at: now,
          updated_at: now,
          is_quick_log: true,
          notes: note,
        }
        const { error } = await supabase.from('timer_sessions').insert(row)
        if (error) {
          console.error('[QuickLog timer_session]', error.message)
          anyInsertFailed = true
        }
      }
      if (anyInsertFailed) {
        setStatusMessage('⚠️ Quick log saved locally but failed to sync — it will retry on next reload.')
      }

      // Refresh Quick Log panel so the new entry is visible immediately
      const { start: qlStart, end: qlEnd } = getWeekBounds(0)
      const qlEntries = await loadQuickLogEntries(qlStart.toISOString(), qlEnd.toISOString(), userId)
      setQuickLogEntries(qlEntries)
    } else {
      // Offline: persist to localStorage for later sync
      const stored = (() => {
        try { return JSON.parse(window.localStorage.getItem(QUICK_LOG_LOCAL_KEY) ?? '[]') } catch { return [] }
      })()
      stored.push({
        who: quickLogForm.who.trim(),
        activityType: quickLogForm.activityType,
        track: quickLogForm.track,
        subTrack: quickLogForm.subTrack.trim() || null,
        durationMinutes: quickLogForm.durationMinutes,
        kpiCredits: quickLogForm.kpiCredits,
        note: quickLogForm.note.trim() || null,
        loggedAt: now,
      })
      window.localStorage.setItem(QUICK_LOG_LOCAL_KEY, JSON.stringify(stored))
      setQuickLogEntries(stored)
    }

    setQuickLogSubmitting(false)
    setShowQuickLog(false)
    setQuickLogToast(true)
    setTimeout(() => setQuickLogToast(false), 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (supabaseConfigured && !session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[min(1800px,calc(100vw-2rem))] items-center justify-center bg-slate-50 p-4 text-slate-900">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <img src="/jasonos-mark.png" alt="CoSA" className="mb-3 h-16 w-16 rounded-[22%]" />
          <p className="mt-1 text-sm text-slate-600">Sign in with Google to sync data across devices.</p>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={authBusy}
            className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {authBusy ? 'Connecting...' : 'Continue with Google'}
          </button>
          {authMessage ? (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{authMessage}</p>
          ) : null}
        </section>
      </main>
    )
  }

  const hasActiveTodayTask = Boolean(activeTask && activeSession)
  const trackMeta = hasActiveTodayTask ? getTrackMeta(activeTask.track) : null
  const isCompleted = hasActiveTodayTask && activeSession.timerState === TIMER_STATES.completed
  const isCancelled = hasActiveTodayTask && activeSession.timerState === TIMER_STATES.cancelled
  const activeScreenLabel = NAV_ITEMS.find((item) => item.id === activeScreen)?.label ?? 'Today'



  function renderTaskLibrary() {
    return (
      <>
      <section className="grid gap-4 p-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Library Tasks</h2>
              <button
                type="button"
                onClick={createLibraryTask}
                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white"
              >
                Add Task
              </button>
            </div>
            <div className="flex gap-1">
              {['Active', ...LIBRARY_STATUSES.filter((s) => s !== 'Active'), 'All'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLibraryFilter(f)}
                  className={`flex-1 rounded-md px-1 py-1 text-[11px] font-medium transition-colors ${
                    libraryFilter === f
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {filteredTaskLibrary.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                No tasks in this filter.
              </p>
            ) : (() => {
              // Group by track in priority order — includes ALL tracks defined in TRACKS
              const trackOrder = Object.values(TRACKS)
                .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
                .map((t) => t.key)
              const grouped = {}
              for (const task of filteredTaskLibrary) {
                const key = task.track ?? TRACKS.advisors.key
                if (!grouped[key]) grouped[key] = []
                grouped[key].push(task)
              }
              return trackOrder.map((trackKey) => {
                const group = grouped[trackKey]
                if (!group || group.length === 0) return null
                const meta = getTrackMeta(trackKey)
                const collapsed = collapsedLibraryTracks[trackKey]
                return (
                  <div key={trackKey}>
                    <button
                      type="button"
                      onClick={() => setCollapsedLibraryTracks((p) => ({ ...p, [trackKey]: !p[trackKey] }))}
                      className="flex w-full items-center justify-between rounded-md px-1 py-1 hover:bg-slate-50"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta?.color }}>
                        {meta?.label ?? trackKey}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {group.length}
                        </span>
                        {collapsed
                          ? <ChevronRight size={12} className="text-slate-400" />
                          : <ChevronDown size={12} className="text-slate-400" />
                        }
                      </div>
                    </button>
                    {!collapsed && (
                      <ul className="mt-1 space-y-1.5 pl-1">
                        {group.map((task) => {
                          const selected = task.id === effectiveSelectedLibraryTaskId
                          const isDeployed = deployedTemplateIds.has(task.id)
                          return (
                            <li key={task.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLibraryTaskId(task.id)
                                  setLibraryMessage('')
                                }}
                                className={`w-full rounded-md border px-2 py-2 text-left text-sm ${
                                  selected
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : isDeployed
                                      ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100'
                                      : task.status === 'Paused'
                                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                        : task.status === 'Archived'
                                          ? 'border-slate-100 bg-white opacity-50 hover:opacity-100'
                                          : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate font-medium">{task.name}</span>
                                  <div className="flex flex-shrink-0 items-center gap-1">
                                    {isDeployed ? (
                                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                        selected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
                                      }`}>
                                        In Today
                                      </span>
                                    ) : null}
                                    {task.status === 'Paused' && !selected && (
                                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                        Paused
                                      </span>
                                    )}
                                    {task.status === 'Archived' && !selected && (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                        Archived
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                  <span>{task.subTrack ?? '—'}</span>
                                  <span>{task.defaultTimeEstimate}m</span>
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </aside>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Task Library</h2>
          <p className="mt-1 text-sm text-slate-600">
            Library edits update template data only. They do not retroactively change current Today tasks.
          </p>

          {!selectedLibraryTask ? (
            <p className="mt-4 text-sm text-slate-600">Select a task to edit.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Name</span>
                <input
                  value={selectedLibraryTask.name}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'name', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Track</span>
                <select
                  value={selectedLibraryTask.track}
                  onChange={(event) => {
                    updateLibraryTask(selectedLibraryTask.id, 'track', event.target.value)
                    // Clear sub-track if it doesn't belong to the new track
                    const newSubTracks = TRACK_SUB_TRACKS[event.target.value] ?? []
                    if (selectedLibraryTask.subTrack && !newSubTracks.includes(selectedLibraryTask.subTrack)) {
                      updateLibraryTask(selectedLibraryTask.id, 'subTrack', null)
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {Object.values(TRACKS).map((track) => (
                    <option key={track.key} value={track.key}>
                      {track.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Sub-Track</span>
                <select
                  value={selectedLibraryTask.subTrack ?? ''}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'subTrack', event.target.value || null)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  <option value="">— none —</option>
                  {(TRACK_SUB_TRACKS[selectedLibraryTask.track] ?? []).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Used for weekly allocation tracking in the Week Planner.
                </p>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Default Time Estimate (minutes)</span>
                <input
                  key={selectedLibraryTask.id}
                  type="number"
                  min={5}
                  step={5}
                  defaultValue={selectedLibraryTask.defaultTimeEstimate}
                  onChange={(event) => {
                    const n = parseInt(event.target.value, 10)
                    if (!isNaN(n) && n >= 1) {
                      updateLibraryTask(selectedLibraryTask.id, 'defaultTimeEstimate', n)
                    }
                  }}
                  onBlur={(event) => {
                    const n = parseInt(event.target.value, 10)
                    updateLibraryTask(
                      selectedLibraryTask.id,
                      'defaultTimeEstimate',
                      Math.max(5, isNaN(n) ? 5 : n),
                    )
                  }}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Status</span>
                <select
                  value={selectedLibraryTask.status}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'status', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {LIBRARY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {getStatusBehavior(selectedLibraryTask.status)}
                </p>
              </label>
              {/* ── Subtasks ─────────────────────────────────────────── */}
              {(() => {
                const taskSubtasks = subtasksMap[selectedLibraryTask.id] ?? []
                const updateSubtask = (stId, patch) => {
                  const next = taskSubtasks.map((s) => s.id === stId ? { ...s, ...patch } : s)
                  updateLibraryTask(selectedLibraryTask.id, 'subtasks', next)
                }
                return (
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      Subtasks <span className="text-xs text-slate-400">(each can optionally have its own checklist items)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newSubtask = { id: `st-${Date.now()}`, text: '', items: [] }
                        updateLibraryTask(selectedLibraryTask.id, 'subtasks', [...taskSubtasks, newSubtask])
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      + Add subtask
                    </button>
                  </div>
                  {taskSubtasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 p-2 text-xs text-slate-400">
                      No subtasks yet — click "Add subtask" to create a checklist.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {taskSubtasks.map((st, stIdx) => {
                        const items = st.items ?? []
                        return (
                          <li key={st.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            {/* Subtask header row */}
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-slate-300">☐</span>
                              <input
                                type="text"
                                value={st.text}
                                placeholder={`Subtask ${stIdx + 1}`}
                                onChange={(e) => updateSubtask(st.id, { text: e.target.value })}
                                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <button
                                type="button"
                                title="Remove subtask"
                                onClick={() => updateLibraryTask(selectedLibraryTask.id, 'subtasks', taskSubtasks.filter((s) => s.id !== st.id))}
                                className="shrink-0 rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Checklist items under this subtask */}
                            {items.length > 0 && (
                              <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-4">
                                {items.map((item, iIdx) => (
                                  <li key={item.id} className="flex items-center gap-2">
                                    <span className="shrink-0 text-[10px] text-slate-300">○</span>
                                    <input
                                      type="text"
                                      value={item.text}
                                      placeholder={`Item ${iIdx + 1}`}
                                      onChange={(e) => {
                                        const nextItems = items.map((it) => it.id === item.id ? { ...it, text: e.target.value } : it)
                                        updateSubtask(st.id, { items: nextItems })
                                      }}
                                      className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-300"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateSubtask(st.id, { items: items.filter((it) => it.id !== item.id) })}
                                      className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-400"
                                    >
                                      ✕
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Add item button */}
                            <button
                              type="button"
                              onClick={() => {
                                const newItem = { id: `it-${Date.now()}`, text: '' }
                                updateSubtask(st.id, { items: [...items, newItem] })
                              }}
                              className="mt-2 ml-4 text-[11px] text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              + add checklist item
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                )
              })()}

              {(libraryValidationMap[selectedLibraryTask.id] ?? []).length > 0 && (
                <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <p className="font-semibold">Validation errors:</p>
                  <ul className="mt-1 space-y-1">
                    {(libraryValidationMap[selectedLibraryTask.id] ?? []).map((errorText) => (
                      <li key={errorText}>- {errorText}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Save / Archive / Delete */}
              <div className="sm:col-span-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                {/* Left side: Archive (active/paused tasks) or Delete (archived tasks) */}
                {selectedLibraryTask.status === 'Archived' ? (
                  // ── Delete flow (only available once already archived) ──────
                  deleteConfirmId === selectedLibraryTask.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Permanently delete this task? This cannot be undone.</span>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLibraryTask(selectedLibraryTask.id)}
                        className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                      >
                        Yes, Delete Permanently
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(selectedLibraryTask.id)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:border-red-400 hover:bg-red-50"
                    >
                      Delete Task
                    </button>
                  )
                ) : (
                  // ── Archive flow (active / paused tasks) ───────────────────
                  archiveConfirmId === selectedLibraryTask.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Archive this task? It won't be deleted, just hidden.</span>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirmId(null)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveLibraryTask(selectedLibraryTask.id)}
                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Yes, Archive
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setArchiveConfirmId(selectedLibraryTask.id)}
                      className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                    >
                      Archive Task
                    </button>
                  )
                )}

                {/* Save side */}
                <button
                  type="button"
                  onClick={saveLibraryTask}
                  disabled={librarySaveStatus === 'saving'}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    librarySaveStatus === 'saved'
                      ? 'bg-green-600 text-white'
                      : librarySaveStatus === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-700 active:scale-95'
                  }`}
                >
                  {librarySaveStatus === 'saving'
                    ? 'Saving…'
                    : librarySaveStatus === 'saved'
                    ? '✓ Saved'
                    : librarySaveStatus === 'error'
                    ? 'Save failed — retry'
                    : 'Save Task'}
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
      </>
    )
  }

  // ── KPI detail handlers (App-level so they always have fresh state) ─────────
  function openKpiDetail(kpi) {
    const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset)
    const { start: monthStart, end: monthEnd } = getMonthBoundsForWeek(weekOffset)
    const rangeStart = kpi.period === 'month' ? monthStart : weekStart
    const rangeEnd   = kpi.period === 'month' ? monthEnd   : weekEnd

    let entries
    if (kpi.isRate) {
      const allVentures = completionLog.filter((e) => {
        const d = new Date(e.completedAt)
        return d >= rangeStart && d <= rangeEnd && e.track === 'ventures' &&
          (e.completionType === 'Done' || e.completionType === 'Done + Outcome')
      })
      entries = allVentures.map((e) => ({ ...e, _dodUsed: !!e.definitionOfDoneUsed }))
    } else {
      entries = completionLog.filter((e) => {
        const d = new Date(e.completedAt)
        if (d < rangeStart || d > rangeEnd) return false
        if (e.kpiMapping !== kpi.kpiMapping) return false
        if (e.completionType === 'Partial' || e.completionType === 'Cancelled') return false
        return true
      })
      const tagContribs = []
      for (const [gcalId, tag] of Object.entries(calendarEventTags)) {
        const credits = tag.kpiCredits
        if (!tag?.date || !Array.isArray(credits) || credits.length === 0) continue
        const d = new Date(`${tag.date}T12:00:00`)
        if (d < rangeStart || d > rangeEnd) continue
        const qtyMap = tag.kpiQuantities && typeof tag.kpiQuantities === 'object' ? tag.kpiQuantities : {}
        for (const mapping of credits) {
          if (mapping !== kpi.kpiMapping) continue
          const qty = typeof qtyMap[mapping] === 'number' && qtyMap[mapping] >= 1 ? qtyMap[mapping] : 1
          tagContribs.push({
            id: `cal-tag-${gcalId}-${mapping}`,
            taskName: tag.title || 'Tagged calendar event',
            kpiMapping: kpi.kpiMapping,
            completedAt: `${tag.date}T12:00:00`,
            elapsedSeconds: Math.round((tag.durationMin ?? 0) * 60),
            quantity: qty,
            completionType: 'Done',
            _fromCalendarTag: true,
          })
        }
      }
      entries = [...entries, ...tagContribs].sort(
        (a, b) => new Date(b.completedAt) - new Date(a.completedAt),
      )
    }
    setKpiDetail({ type: 'kpi', title: kpi.label, kpi, entries })
  }

  function openScoreDetail() {
    const { kpiResults } = kpiSummary
    setKpiDetail({
      type: 'score',
      title: 'Week Score Breakdown',
      kpiResults: kpiResults.filter((k) => k.countsTowardWeekScore !== false),
    })
  }

  function openTrackDetail(trackData) {
    const mergedEntries = [
      ...trackData.entries,
      ...(trackData.splitEntries ?? []),
    ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    setKpiDetail({
      type: 'track',
      title: `${trackData.track.label} — Logged This Week`,
      trackData: { ...trackData, entries: mergedEntries },
    })
  }

  function renderKpiDashboard() {
    const { start: weekStart, end: weekEnd, startStr: weekStartStr } = getWeekBounds(weekOffset)
    const { start: monthStart, end: monthEnd } = getMonthBoundsForWeek(weekOffset)
    const isCurrentWeek = weekOffset === 0

    const { kpisHit, kpisTotal, weekScore, kpiResults } = kpiSummary
    const weeklyKpis = kpiResults.filter(
      (k) => !k.isRate && k.period === 'week' && k.target && k.countsTowardWeekScore !== false,
    )

    const scoreConfig = {
      green:  { label: 'Green',  desc: '7+ KPIs hit — strong week',     bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
      yellow: { label: 'Yellow', desc: '4–6 KPIs hit — room to improve', bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300'   },
      red:    { label: 'Red',    desc: '3 or fewer KPIs hit — regroup',  bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300'    },
    }
    const score = scoreConfig[weekScore]

    // Time This Week = completionLog only (timer sessions + quick logs).
    // Calendar events — regardless of source or tagging — are the PLAN layer only.

    const TRACK_MIN_TARGETS = {
      advisors:    700,
      jobSearch:   700,
      ventures:    500,
      development:  60,
      cosaAdmin:    60,
    }
    const networkingMinutesThisWeek = completionLog.reduce((sum, e) => {
      const d = new Date(e.completedAt)
      if (d < weekStart || d > weekEnd) return sum
      if (e.track !== 'networking') return sum
      return sum + Math.round((e.elapsedSeconds ?? 0) / 60)
    }, 0)
    const timeByTrack = Object.values(TRACKS)
      .filter((track) => track.key !== 'networking')
      .map((track) => {
        const entries = completionLog.filter((e) => {
          const d = new Date(e.completedAt)
          return d >= weekStart && d <= weekEnd && e.track === track.key
        })
        let minutesLogged = entries.reduce((sum, e) => sum + Math.round((e.elapsedSeconds ?? 0) / 60), 0)
        if (track.key === 'advisors') minutesLogged += Math.round(networkingMinutesThisWeek / 2)
        if (track.key === 'jobSearch') {
          minutesLogged += networkingMinutesThisWeek - Math.round(networkingMinutesThisWeek / 2)
        }
        const targetMins = TRACK_MIN_TARGETS[track.key] ?? 0
        const pctRaw = targetMins > 0 ? Math.round((minutesLogged / targetMins) * 100) : 0
        const pct = Math.min(100, pctRaw) // bar width capped at 100%
        const splitEntries =
          track.key === 'advisors' || track.key === 'jobSearch'
            ? completionLog.filter((e) => {
                const d = new Date(e.completedAt)
                return d >= weekStart && d <= weekEnd && e.track === 'networking'
              })
            : []

        // Sub-track breakdown from timer sessions only
        const subTrackTotals = {}
        for (const e of entries) {
          const st = e.subTrack
          if (!st) continue
          subTrackTotals[st] = (subTrackTotals[st] ?? 0) + Math.round((e.elapsedSeconds ?? 0) / 60)
        }
        const subTrackRows = Object.entries(subTrackTotals).sort((a, b) => b[1] - a[1])

        return {
          track,
          minutesLogged,
          targetMins,
          pct,
          pctRaw,
          entries,
          splitEntries,
          subTrackRows,
        }
      })
      .filter((t) => t.targetMins > 0)

    const savedReview = fridayReviews.find((r) => r.week_start === weekStartStr)

    // ── Detail-drawer helpers ────────────────────────────────────────────────
    /** Normalise a task/event title for fuzzy deduplication. */
    function normTitle(s) {
      return String(s ?? '')
        .toLowerCase()
        .replace(/^meeting:\s*/i, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30)
    }

    function renderKpiGroupCard(group) {
      const groupKpis = kpiResults.filter((k) => k.trackGroup === group)
      const accentColor =
        groupKpis[0]?.color
        ?? KPI_DEFINITIONS.find((d) => d.trackGroup === group)?.color
        ?? '#64748b'
      const periodLabel =
        groupKpis[0]?.period === 'month' ? 'Month' : 'Week'
      return (
        <article key={group} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2" style={{ backgroundColor: `${accentColor}18` }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            <h2 className="text-sm font-semibold text-slate-800">{group}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">KPI</th>
                  <th className="px-3 py-2 text-center font-medium">Target</th>
                  <th className="px-3 py-2 text-center font-medium">This {periodLabel}</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {groupKpis.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400 italic">
                      No KPIs defined for this track yet.
                    </td>
                  </tr>
                ) : (
                  groupKpis.map((kpi) => (
                    <tr
                      key={kpi.id}
                      className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => openKpiDetail(kpi)}
                      title="Click to see contributing sessions"
                    >
                      <td className="px-4 py-2.5 text-slate-700">
                        <span className="group-hover:underline">{kpi.label}</span>
                        <span className="ml-1 text-[10px] text-slate-300">↗</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500">
                        {kpi.isRate ? 'Every session' : kpi.target ? `${kpi.target}/${kpi.period === 'month' ? 'mo' : 'wk'}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium text-slate-900">
                        {kpi.isRate
                          ? kpi.total > 0 ? `${kpi.count}/${kpi.total}` : '—'
                          : kpi.count}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {kpi.isRate && kpi.total === 0 ? (
                          <span className="text-slate-400 text-xs">No sessions</span>
                        ) : kpi.hit ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Hit</span>
                        ) : (
                          <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">✗ Miss</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )
    }

    // Helper: build a timeByTrack array for any arbitrary week range from completionLog.
    // Used for past-week exports where we don't have live calendar data.
    function buildTimeByTrack(ws, we) {
      const netMins = completionLog.reduce((sum, e) => {
        const d = new Date(e.completedAt)
        if (d < ws || d > we || e.track !== 'networking') return sum
        return sum + Math.round((e.elapsedSeconds ?? 0) / 60)
      }, 0)
      return Object.values(TRACKS)
        .filter((track) => track.key !== 'networking')
        .map((track) => {
          const entries = completionLog.filter((e) => {
            const d = new Date(e.completedAt)
            return d >= ws && d <= we && e.track === track.key
          })
          let minutesLogged = entries.reduce((sum, e) => sum + Math.round((e.elapsedSeconds ?? 0) / 60), 0)
          if (track.key === 'advisors') minutesLogged += Math.round(netMins / 2)
          if (track.key === 'jobSearch') minutesLogged += netMins - Math.round(netMins / 2)
          const targetMins = TRACK_MIN_TARGETS[track.key] ?? 0
          const pctRaw = targetMins > 0 ? Math.round((minutesLogged / targetMins) * 100) : 0
          const splitEntries = (track.key === 'advisors' || track.key === 'jobSearch')
            ? completionLog.filter((e) => {
                const d = new Date(e.completedAt)
                return d >= ws && d <= we && e.track === 'networking'
              })
            : []
          const subTrackTotals = {}
          for (const e of entries) {
            if (!e.subTrack) continue
            subTrackTotals[e.subTrack] = (subTrackTotals[e.subTrack] ?? 0) + Math.round((e.elapsedSeconds ?? 0) / 60)
          }
          return {
            track, minutesLogged, targetMins, pct: Math.min(100, pctRaw), pctRaw,
            entries, splitEntries, calendarMins: 0,
            subTrackRows: Object.entries(subTrackTotals).sort((a, b) => b[1] - a[1]),
          }
        })
        .filter((t) => t.targetMins > 0)
    }

    // Helper: compute full kpiResults for any week range using completionLog + calendarEventTags.
    function buildKpiResultsForWeek(ws, we) {
      const ms = new Date(ws.getFullYear(), ws.getMonth(), 1)
      const me = new Date(ws.getFullYear(), ws.getMonth() + 1, 0, 23, 59, 59, 999)
      return KPI_DEFINITIONS.map((def) => {
        const { count: logCount, total } = countKpi(completionLog, def, ws, we, ms, me)
        const calCount = countCalendarTagKpiCredits(calendarEventTags, def, ws, we, ms, me)
        const count = logCount + calCount
        return { ...def, count, total, hit: isKpiHit(count, total, def) }
      })
    }

    function handleExportReport() {
      exportWeeklyReportHTML({
        weekStart,
        weekEnd,
        kpiSummary,
        kpiTrackGroups: KPI_TRACK_GROUPS,
        timeByTrack,
        completionLog: completionLog.filter((e) => {
          const d = new Date(e.completedAt)
          return d >= weekStart && d <= weekEnd
        }),
        fridayReview: savedReview ?? null,
      })
    }

    // Export PDF for the current week's Friday Review — identical to the nav Export button.
    function handlePrintReview() {
      exportWeeklyReportHTML({
        weekStart,
        weekEnd,
        kpiSummary,
        kpiTrackGroups: KPI_TRACK_GROUPS,
        timeByTrack,
        completionLog: completionLog.filter((e) => {
          const d = new Date(e.completedAt)
          return d >= weekStart && d <= weekEnd
        }),
        fridayReview: savedReview ?? null,
      })
    }

    // Export PDF for a past week — rebuilds time and KPI data from completionLog history.
    function handlePrintPastReview(r) {
      const ws = new Date(r.week_start + 'T12:00:00')
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      we.setHours(23, 59, 59, 999)
      const pastTimeByTrack = buildTimeByTrack(ws, we)
      const pastKpiResults = buildKpiResultsForWeek(ws, we)
      const weeklyKpisForScore = pastKpiResults.filter(
        (k) => !k.isRate && k.period === 'week' && k.target && k.countsTowardWeekScore !== false,
      )
      const pastKpisHit = weeklyKpisForScore.filter((k) => k.hit).length
      exportWeeklyReportHTML({
        weekStart: ws,
        weekEnd: we,
        kpiSummary: {
          weekScore: r.week_score ?? 'red',
          kpisHit: pastKpisHit,
          kpisTotal: weeklyKpisForScore.length,
          kpiResults: pastKpiResults,
        },
        kpiTrackGroups: KPI_TRACK_GROUPS,
        timeByTrack: pastTimeByTrack,
        completionLog: completionLog.filter((e) => {
          const d = new Date(e.completedAt)
          return d >= ws && d <= we
        }),
        fridayReview: r,
      })
    }

    return (
      <section className="space-y-4 p-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Prev
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Weekly Review</p>
            <p className="text-sm font-semibold text-slate-900">{formatWeekLabel(weekStart, weekEnd)}</p>
            {isCurrentWeek ? <p className="text-xs text-slate-500">Current week</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setReconcileExpandedTracks({}); setShowReconcileLog(true) }}
              title="View, edit, or delete logged entries for this week"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100"
            >
              ⚖ Reconcile
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              title="Export this week as a printable HTML report"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              ↗ Export
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
              disabled={isCurrentWeek}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Week score, time by track, KPI tables, quick logs */}
        <div className="space-y-4">
        {/* Week score — clickable */}
        <article
          className={`rounded-xl border ${score.border} ${score.bg} p-4 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-transform`}
          onClick={openScoreDetail}
          title="Click to see KPI breakdown"
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Week Score</p>
          <p className={`mt-1 text-2xl font-bold ${score.text}`}>{score.label}</p>
          <p className={`text-sm ${score.text}`}>{score.desc}</p>
          <p className={`mt-1 text-xs ${score.text} opacity-80`}>
            {kpisHit} of {weeklyKpis.length} weekly KPIs hit · <span className="underline underline-offset-2">see breakdown</span>
          </p>
        </article>

        {/* Left: time + Job Search KPIs · Right: other track KPI scorecards */}
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <div className="min-w-0 space-y-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Time This Week</h2>
              <p className="mb-3 text-[11px] text-slate-500">
                Bars reflect your timer sessions and quick logs.
              </p>

              <div className="space-y-3">
                {timeByTrack.map((trackData) => {
                  const { track, minutesLogged, targetMins, pct, pctRaw } = trackData
                  return (
                    <div
                      key={track.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => openTrackDetail(trackData)}
                      onKeyDown={(e) => e.key === 'Enter' && openTrackDetail(trackData)}
                      className="w-full cursor-pointer text-left rounded-lg p-2 -mx-2 hover:bg-slate-50 transition-colors"
                      title="Click to see contributing sessions"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs gap-2">
                        <span className="font-medium text-slate-700">{track.label}</span>
                        <span
                          className={`shrink-0 font-semibold ${pct >= 100 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-slate-500'}`}
                        >
                          {minutesLogged}m{' '}
                          <span className="font-normal text-slate-400">/ {targetMins}m target</span>
                        </span>
                      </div>
                      {/* % complete centered above the bar */}
                      <div className="relative mb-0.5 text-center">
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: track.color }}
                        >
                          {pctRaw}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: track.color }}
                        />
                      </div>
                    </div>
                  )
                })}
                {timeByTrack.every((t) => t.minutesLogged < 1) && (
                  <p className="text-xs text-slate-400 italic">No logged sessions this week yet.</p>
                )}
              </div>
            </article>
            {renderKpiGroupCard('Job Search')}
          </div>

          <div className="min-w-0 space-y-4">
            {/* Time allocation donut chart — all tracks except Shared Networking */}
            {(() => {
              // totalTarget = full weekly target across all tracks (the denominator).
              // Each slice shows how much of the week's total planned time that track
              // has consumed, so percentages reflect progress against the full week
              // budget rather than being relative to each other.
              const totalTarget = timeByTrack.reduce((s, t) => s + t.targetMins, 0)
              const totalLogged = timeByTrack.reduce((s, t) => s + t.minutesLogged, 0)
              const chartTracks = timeByTrack.filter((t) => t.track.key !== 'networking' && t.minutesLogged > 0)
              const r = 38, CX = 50, CY = 50
              const circ = 2 * Math.PI * r
              const GAP = 0
              let cumFrac = 0
              const segments = chartTracks.map((td) => {
                const frac = totalTarget > 0 ? td.minutesLogged / totalTarget : 0
                const arcLen = Math.max(frac * circ - GAP, 0)
                const dashOffset = circ * (1 - cumFrac)
                cumFrac += frac
                return { td, arcLen, dashOffset, pct: Math.round(frac * 100) }
              })
              const loggedHours = (totalLogged / 60).toFixed(1)
              const targetHours = (totalTarget / 60).toFixed(0)
              return (
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Time Allocation</h2>
                  {totalLogged < 1 ? (
                    <p className="text-xs text-slate-400 italic">No logged time this week yet.</p>
                  ) : (
                    <div className="flex items-center gap-6">
                      {/* Donut — ring fills proportionally to logged vs. total week target */}
                      <div className="relative shrink-0 h-36 w-36">
                        <svg viewBox="0 0 100 100" className="h-full w-full" style={{ transform: 'rotate(-90deg)' }}>
                          {/* Full background ring = total week target */}
                          <circle cx={CX} cy={CY} r={r} fill="none" stroke="#f1f5f9" strokeWidth={18} />
                          {segments.map(({ td, arcLen, dashOffset }) => (
                            <circle
                              key={td.track.key}
                              cx={CX} cy={CY} r={r}
                              fill="none"
                              stroke={td.track.color}
                              strokeWidth={18}
                              strokeLinecap="butt"
                              strokeDasharray={`${arcLen} ${circ - arcLen}`}
                              strokeDashoffset={dashOffset}
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-slate-700 leading-none">{loggedHours}h</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">of {targetHours}h target</span>
                        </div>
                      </div>

                      {/* Legend — % = track logged ÷ total week target */}
                      <div className="flex flex-col gap-2.5 min-w-0 flex-1">
                        {segments.map(({ td, pct }) => (
                          <button
                            key={td.track.key}
                            type="button"
                            onClick={() => openTrackDetail(td)}
                            className="flex items-center gap-2 w-full text-left group"
                          >
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: td.track.color }} />
                            <span className="text-xs text-slate-600 truncate group-hover:text-slate-900 transition-colors">
                              {td.track.label}
                            </span>
                            <span className="shrink-0 text-xs font-semibold ml-auto pl-2" style={{ color: td.track.color }}>
                              {pct}%
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-400 w-12 text-right">
                              {td.minutesLogged}m
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              )
            })()}

            {/* KPI scorecards: Advisors, Ventures, … (Job Search is in the left column) */}
            {KPI_TRACK_GROUPS.filter((group) => group !== 'Job Search').map((group) => renderKpiGroupCard(group))}
          </div>
        </div>

        {/* Quick Logs — this week's impromptu activity */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Quick Logs — This Week</h2>
          {quickLogEntries.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No quick logs this week. Use the ⚡ button to log an impromptu call, coffee chat, or message.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quickLogEntries.map((entry, i) => {
                const loggedAt = entry.logged_at ?? entry.loggedAt
                const timeStr = loggedAt
                  ? new Date(loggedAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : ''
                const kpis = Array.isArray(entry.kpi_credits ?? entry.kpiCredits)
                  ? (entry.kpi_credits ?? entry.kpiCredits)
                  : []
                const trackKey = entry.track ?? KPI_LABEL_TO_TRACK[kpis[0]] ?? null
                const trackMeta = trackKey ? getTrackMeta(trackKey) : null
                const subTrack = entry.sub_track ?? entry.subTrack ?? null
                return (
                  <li key={entry.id ?? i} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {trackMeta && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: trackMeta.color }}
                            >
                              {trackMeta.label}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800">
                            {entry.activity_type ?? entry.activityType}
                            <span className="ml-1 font-normal text-slate-500">with {entry.who}</span>
                            <span className="ml-1 text-slate-400">· {entry.duration_minutes ?? entry.durationMinutes}m</span>
                          </span>
                        </div>
                        {subTrack && (
                          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">{subTrack}</p>
                        )}
                        {kpis.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-slate-500">{kpis.join(' · ')}</p>
                        )}
                        {(entry.note) && (
                          <p className="mt-0.5 text-[11px] italic text-slate-400">"{entry.note}"</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeStr}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        </div>

        {/* Friday Review & past reviews */}
        <div className="mt-8 space-y-4 border-t border-slate-200 pt-8">
        {/* ── Friday Review ─────────────────────────────────────────────── */}
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Friday Review</h2>
              <p className="text-xs text-slate-500">{formatWeekLabel(weekStart, weekEnd)}</p>
            </div>
            <div className="flex items-center gap-2">
              {savedReview ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Saved</span>
              ) : null}
              {(reviewDraft.q1 || reviewDraft.q2 || reviewDraft.q3 || reviewDraft.mondayIntention) && savedReview ? (
                <button
                  type="button"
                  onClick={handlePrintReview}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* Score summary (read-only, auto-populated) */}
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${scoreConfig[weekScore].bg} ${scoreConfig[weekScore].border}`}>
              <span className={`text-sm font-bold ${scoreConfig[weekScore].text}`}>{scoreConfig[weekScore].label} week</span>
              <span className={`text-xs ${scoreConfig[weekScore].text} opacity-80`}>{kpisHit} of {kpisTotal} KPIs hit — auto-filled from above</span>
            </div>

            <div className="space-y-3">
              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">What actually got in the way this week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q1}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q1: e.target.value }))}
                  placeholder="Be honest — what blocked you or slowed you down?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">One thing to do differently next week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q2}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q2: e.target.value }))}
                  placeholder="One concrete change — be specific."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">One thing you did well this week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q3}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q3: e.target.value }))}
                  placeholder="Don't skip this — it matters."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">Monday intention</p>
                <textarea
                  rows={2}
                  value={reviewDraft.mondayIntention}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, mondayIntention: e.target.value }))}
                  placeholder="What's the one thing Monday must deliver?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveFridayReview}
                disabled={reviewSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {reviewSaving ? 'Saving…' : savedReview ? 'Update Review' : 'Save Review'}
              </button>
              {savedReview ? (
                <button
                  type="button"
                  onClick={handlePrintReview}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              ) : null}
            </div>
          </div>
        </article>

        {/* Past reviews (last 5, excluding current week) */}
        {fridayReviews.filter((r) => r.week_start !== weekStartStr).length > 0 ? (
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Past Reviews</h2>
            <ul className="space-y-2">
              {fridayReviews
                .filter((r) => r.week_start !== weekStartStr)
                .slice(0, 5)
                .map((r) => {
                  const sc = scoreConfig[r.week_score] ?? scoreConfig.red
                  return (
                    <li key={r.week_start} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sc.bg} ${sc.text}`}>{r.week_score?.toUpperCase()}</span>
                      <span className="text-xs font-medium text-slate-700">{formatDate(r.week_start)}</span>
                      <span className="text-xs text-slate-500">{r.kpis_hit}/{r.kpis_total} KPIs</span>
                      {r.monday_intention ? (
                        <span className="ml-1 flex-1 truncate text-xs text-slate-400 italic">"{r.monday_intention}"</span>
                      ) : <span className="flex-1" />}
                      <button
                        type="button"
                        onClick={() => handlePrintPastReview(r)}
                        className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                      >
                        Export PDF
                      </button>
                    </li>
                  )
                })}
            </ul>
          </article>
        ) : null}

        </div>

      </section>
    )
  }

  function renderPlaceholderScreen(title, message) {
    return (
      <section className="p-4">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </article>
      </section>
    )
  }

  // ── Loading / error gate — block full render until Supabase sync is done ──
  if (syncStatus === 'loading' || syncStatus === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-xs space-y-8 text-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">CoSA</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Command of Strategic Action</h1>
          </div>

          {syncStatus === 'loading' ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
              </div>
              <p className="text-sm text-slate-500">{syncStep}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {syncError || 'Something went wrong loading your data.'}
              </p>
              <button
                type="button"
                onClick={() => { setSyncStatus('loading'); setSyncTrigger((n) => n + 1) }}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[min(1800px,calc(100vw-2rem))] bg-slate-50 pb-24 text-slate-900">

      {/* KPI / Track detail modal — rendered at root so z-index always wins */}
      {kpiDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setKpiDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">{kpiDetail.title}</h3>
              <button
                type="button"
                onClick={() => setKpiDetail(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {kpiDetail.type === 'score' && (
                <div className="space-y-1.5">
                  {kpiDetail.kpiResults.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{k.label}</p>
                        <p className="text-[11px] text-slate-400">{k.trackGroup} · {k.period}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">
                          {k.isRate
                            ? k.total > 0 ? `${k.count}/${k.total}` : '—'
                            : `${k.count}${k.target ? ` / ${k.target}` : ''}`}
                        </span>
                        {k.isRate && k.total === 0 ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">—</span>
                        ) : k.hit ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Hit</span>
                        ) : (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">✗ Miss</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {kpiDetail.type === 'track' && (
                kpiDetail.trackData.entries.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No sessions logged for this track in this period.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {[...kpiDetail.trackData.entries]
                      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                      .map((e, i) => {
                        const elapsed = Math.round((e.elapsedSeconds ?? 0) / 60)
                        const dayStr = new Date(e.completedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        const sourceLabel = e._fromCalendar
                          ? e._calendarSource === 'personal-tagged'
                            ? { text: '📅 Tagged event', cls: 'bg-indigo-50 text-indigo-600' }
                            : { text: '📅 CoSA event', cls: 'bg-violet-50 text-violet-600' }
                          : e.isQuickLog
                          ? { text: '⚡ Quick log', cls: 'bg-amber-50 text-amber-700' }
                          : { text: '⏱ Timer', cls: 'bg-slate-100 text-slate-500' }
                        return (
                          <li key={e.id ?? i} className="py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{e.taskName}</p>
                                <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceLabel.cls}`}>{sourceLabel.text}</span>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-medium text-slate-700">{elapsed}m</p>
                                <p className="text-[11px] text-slate-400">{dayStr}</p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                )
              )}

              {kpiDetail.type === 'kpi' && (
                kpiDetail.entries.length === 0 ? (
                  <div className="space-y-2 py-2">
                    <p className="text-sm text-slate-400 italic">Nothing logged for this KPI yet this period.</p>
                    <p className="text-[11px] text-slate-400">
                      Credits come from: timer completions on tasks mapped to this KPI, Quick Log entries, or calendar events tagged with this KPI credit.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {[...kpiDetail.entries]
                      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                      .map((e, i) => {
                        const dayStr = new Date(e.completedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        const elapsed = Math.round((e.elapsedSeconds ?? 0) / 60)
                        const sourceLabel = e._fromCalendarTag
                          ? { text: '📅 Calendar tag', cls: 'bg-indigo-50 text-indigo-600' }
                          : e.isQuickLog
                          ? { text: '⚡ Quick log', cls: 'bg-amber-50 text-amber-700' }
                          : { text: '⏱ Timer', cls: 'bg-slate-100 text-slate-500' }
                        return (
                          <li key={e.id ?? i} className="py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{e.taskName}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceLabel.cls}`}>{sourceLabel.text}</span>
                                  {e.subTrack && (
                                    <span className="text-[10px] text-slate-400">{e.subTrack}</span>
                                  )}
                                  {!kpiDetail.kpi.isRate && (e.quantity ?? 1) > 1 && (
                                    <span className="text-[10px] text-slate-400">×{e.quantity} units</span>
                                  )}
                                  {kpiDetail.kpi.isRate && (
                                    <span className="text-[10px] text-slate-400">
                                      {e._dodUsed ? '✓ DoD used' : '✗ No DoD'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-medium text-slate-700">{elapsed > 0 ? `${elapsed}m` : '—'}</p>
                                <p className="text-[11px] text-slate-400">{dayStr}</p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                )
              )}
            </div>

            {kpiDetail.type === 'track' && kpiDetail.trackData.entries.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>
                  {kpiDetail.trackData.entries.filter(e => !e.isQuickLog).length} timer
                  {kpiDetail.trackData.entries.filter(e => e.isQuickLog).length > 0 && ` + ${kpiDetail.trackData.entries.filter(e => e.isQuickLog).length} quick log`}
                </span>
                <span className="font-semibold">{kpiDetail.trackData.minutesLogged}m of {kpiDetail.trackData.targetMins}m target</span>
              </div>
            )}
            {kpiDetail.type === 'kpi' && kpiDetail.entries.length > 0 && !kpiDetail.kpi?.isRate && (
              <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>{kpiDetail.entries.length} entr{kpiDetail.entries.length !== 1 ? 'ies' : 'y'}</span>
                <span className="font-semibold">
                  {kpiDetail.entries.reduce((s, e) => s + (e.quantity ?? 1), 0)} total
                  {kpiDetail.kpi?.target ? ` / ${kpiDetail.kpi.target} target` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Reconcile Log Modal ──────────────────────────────────────────────── */}
      {showReconcileLog && (() => {
        const { start: rWeekStart, end: rWeekEnd } = getWeekBounds(weekOffset)
        const weekEntries = completionLog.filter((e) => {
          if (!e.completedAt) return false
          const d = new Date(e.completedAt)
          return d >= rWeekStart && d <= rWeekEnd
        })
        const trackOrder = Object.values(TRACKS).map((t) => t.key)
        const grouped = {}
        for (const entry of weekEntries) {
          const t = entry.track ?? 'unknown'
          if (!grouped[t]) grouped[t] = []
          grouped[t].push(entry)
        }

        const handleReconcileDelete = async (entryId) => {
          if (!window.confirm('Delete this logged entry? This cannot be undone.')) return
          setCompletionLog((prev) => prev.filter((e) => e.id !== entryId))
          if (supabaseConfigured && session?.user?.id) {
            await deleteTimerSession(entryId, session.user.id)
          }
          if (reconcileEditId === entryId) setReconcileEditId(null)
        }

        const handleReconcileEditStart = (entry) => {
          setReconcileEditId(entry.id)
          setReconcileEditForm({
            taskName: entry.taskName ?? '',
            track: entry.track ?? 'advisors',
            subTrack: entry.subTrack ?? '',
            kpiMapping: entry.kpiMapping ?? '',
            completionType: entry.completionType ?? 'Done',
            elapsedMinutes: Math.round((entry.elapsedSeconds ?? 0) / 60),
            quantity: entry.quantity ?? 1,
            kpiValuesStr: JSON.stringify(entry.kpiValues ?? {}, null, 2),
          })
        }

        const handleReconcileEditSave = async (entryId) => {
          let kpiValues = {}
          try { kpiValues = JSON.parse(reconcileEditForm.kpiValuesStr || '{}') } catch { kpiValues = {} }
          const elapsedSeconds = Math.round((reconcileEditForm.elapsedMinutes ?? 0) * 60)
          const quantity = Number(reconcileEditForm.quantity) || 1
          setCompletionLog((prev) => prev.map((e) => e.id !== entryId ? e : {
            ...e,
            taskName: reconcileEditForm.taskName,
            track: reconcileEditForm.track,
            subTrack: reconcileEditForm.subTrack,
            kpiMapping: reconcileEditForm.kpiMapping,
            completionType: reconcileEditForm.completionType,
            elapsedSeconds,
            quantity,
            kpiValues,
          }))
          if (supabaseConfigured && session?.user?.id) {
            await updateTimerSession(entryId, {
              task_name: reconcileEditForm.taskName,
              track: reconcileEditForm.track,
              sub_track: reconcileEditForm.subTrack,
              kpi_mapping: reconcileEditForm.kpiMapping,
              completion_type: reconcileEditForm.completionType,
              elapsed_seconds: elapsedSeconds,
              quantity,
              kpi_values: kpiValues,
            }, session.user.id)
          }
          setReconcileEditId(null)
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
            onClick={(e) => { if (e.target === e.currentTarget) setShowReconcileLog(false) }}
          >
            <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Reconcile Log</h2>
                  <p className="text-xs text-slate-500">
                    {formatWeekLabel(rWeekStart, rWeekEnd)} · {weekEntries.length} entr{weekEntries.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReconcileLog(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {weekEntries.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-400 italic">No logged entries for this week yet.</p>
                ) : Object.entries(grouped)
                    .sort(([a], [b]) => {
                      const ai = trackOrder.indexOf(a)
                      const bi = trackOrder.indexOf(b)
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                    })
                    .map(([trackKey, entries]) => {
                      const meta = getTrackMeta(trackKey)
                      const trackTotalMin = entries.reduce((s, e) => s + Math.round((e.elapsedSeconds ?? 0) / 60), 0)
                      const isExpanded = reconcileExpandedTracks[trackKey] === true
                      return (
                        <div key={trackKey}>
                          <button
                            type="button"
                            onClick={() => setReconcileExpandedTracks((p) => ({ ...p, [trackKey]: !p[trackKey] }))}
                            className="mb-2 flex w-full items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50 transition-colors text-left"
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta?.color ?? '#94a3b8' }}>
                              {meta?.label ?? trackKey}
                            </span>
                            <span className="text-xs text-slate-400">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {trackTotalMin}m</span>
                            <span className="ml-auto text-[10px] text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                          {isExpanded && <div className="space-y-2">
                            {entries.map((entry) => {
                              const isEditing = reconcileEditId === entry.id
                              const elapsed = Math.round((entry.elapsedSeconds ?? 0) / 60)
                              const dt = entry.completedAt ? new Date(entry.completedAt) : null
                              const dateLabel = dt
                                ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
                                  ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                : '—'

                              if (isEditing) {
                                return (
                                  <div key={entry.id} className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-amber-700">Editing entry</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="col-span-2">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Task Name</label>
                                        <input
                                          type="text"
                                          value={reconcileEditForm.taskName}
                                          onChange={(e) => setReconcileEditForm((f) => ({ ...f, taskName: e.target.value }))}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Track</label>
                                        <select
                                          value={reconcileEditForm.track}
                                          onChange={(e) => setReconcileEditForm((f) => ({ ...f, track: e.target.value, subTrack: '', kpiMapping: '' }))}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                        >
                                          {Object.values(TRACKS).map((t) => (
                                            <option key={t.key} value={t.key}>{t.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Sub-track</label>
                                        {(TRACK_SUB_TRACKS[reconcileEditForm.track] ?? []).length > 0 ? (
                                          <select
                                            value={reconcileEditForm.subTrack}
                                            onChange={(e) => setReconcileEditForm((f) => ({ ...f, subTrack: e.target.value }))}
                                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                          >
                                            <option value="">— None —</option>
                                            {(TRACK_SUB_TRACKS[reconcileEditForm.track] ?? []).map((st) => (
                                              <option key={st} value={st}>{st}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            value={reconcileEditForm.subTrack}
                                            onChange={(e) => setReconcileEditForm((f) => ({ ...f, subTrack: e.target.value }))}
                                            placeholder="—"
                                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                          />
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Time Logged (minutes)</label>
                                        <input
                                          type="number"
                                          min={0}
                                          value={reconcileEditForm.elapsedMinutes}
                                          onChange={(e) => setReconcileEditForm((f) => ({ ...f, elapsedMinutes: Number(e.target.value) }))}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Completion Type</label>
                                        <select
                                          value={reconcileEditForm.completionType}
                                          onChange={(e) => setReconcileEditForm((f) => ({ ...f, completionType: e.target.value }))}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                        >
                                          {['Done', 'Done + Outcome', 'Full Credit', 'Cancelled'].map((ct) => (
                                            <option key={ct} value={ct}>{ct}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="col-span-2">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">KPI Credit</label>
                                        {(() => {
                                          const kpiGroups = QUICK_LOG_KPI_GROUPS.filter((g) => g.track === reconcileEditForm.track)
                                          const allMappings = kpiGroups.flatMap((g) => g.kpis)
                                          return allMappings.length > 0 ? (
                                            <div className="space-y-2">
                                              {kpiGroups.map((grp) => (
                                                <div key={grp.group}>
                                                  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: grp.color }} />
                                                    {grp.group}
                                                  </p>
                                                  <div className="space-y-1">
                                                    {grp.kpis.map((kpiRow) => {
                                                      const selected = reconcileEditForm.kpiMapping === kpiRow.mapping
                                                      return (
                                                        <label key={kpiRow.mapping} className="flex cursor-pointer items-center gap-2">
                                                          <input
                                                            type="radio"
                                                            name={`kpiMapping-${entry.id}`}
                                                            checked={selected}
                                                            onChange={() => setReconcileEditForm((f) => ({ ...f, kpiMapping: kpiRow.mapping }))}
                                                            className="accent-slate-900"
                                                          />
                                                          <span className="text-xs text-slate-700">{kpiRow.label}</span>
                                                        </label>
                                                      )
                                                    })}
                                                  </div>
                                                </div>
                                              ))}
                                              <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                  type="radio"
                                                  name={`kpiMapping-${entry.id}`}
                                                  checked={reconcileEditForm.kpiMapping === ''}
                                                  onChange={() => setReconcileEditForm((f) => ({ ...f, kpiMapping: '' }))}
                                                  className="accent-slate-900"
                                                />
                                                <span className="text-xs text-slate-400 italic">No KPI credit</span>
                                              </label>
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={reconcileEditForm.kpiMapping}
                                              onChange={(e) => setReconcileEditForm((f) => ({ ...f, kpiMapping: e.target.value }))}
                                              placeholder="KPI mapping string"
                                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ring-amber-300"
                                            />
                                          )
                                        })()}
                                      </div>
                                      {reconcileEditForm.kpiMapping && (
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Quantity</label>
                                          <div className="flex items-center gap-1.5">
                                            <button type="button" onClick={() => setReconcileEditForm((f) => ({ ...f, quantity: Math.max(1, (f.quantity ?? 1) - 1) }))} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm text-slate-600 hover:bg-slate-100">−</button>
                                            <span className="w-8 text-center text-sm font-medium text-slate-800">{reconcileEditForm.quantity ?? 1}</span>
                                            <button type="button" onClick={() => setReconcileEditForm((f) => ({ ...f, quantity: (f.quantity ?? 1) + 1 }))} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-sm text-slate-600 hover:bg-slate-100">+</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleReconcileEditSave(entry.id)}
                                        className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setReconcileEditId(null)}
                                        className="rounded border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )
                              }

                              return (
                                <div key={entry.id} className="group flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3 hover:border-slate-200 transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium text-slate-800">{entry.taskName}</span>
                                      {entry.isQuickLog && (
                                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Quick Log</span>
                                      )}
                                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                        {entry.completionType ?? 'Done'}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                                      <span className="font-medium text-slate-600">{elapsed}m logged</span>
                                      {entry.subTrack && <span>· {entry.subTrack}</span>}
                                      {entry.kpiMapping && <span>· {entry.kpiMapping}</span>}
                                      <span>· {dateLabel}</span>
                                    </div>
                                    {entry.kpiValues && Object.keys(entry.kpiValues).length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {Object.entries(entry.kpiValues).map(([k, v]) => (
                                          <span key={k} className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                                            {k}: {v}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => handleReconcileEditStart(entry)}
                                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReconcileDelete(entry.id)}
                                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>}
                        </div>
                      )
                    })}

              </div>
            </div>
          </div>
        )
      })()}

      {/* Clear Day Modal */}
      {showClearDayModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Clear Day</h2>
            <p className="mt-1 text-xs text-slate-500">
              No tasks will be deployed for these dates. Auto-population will be suppressed.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate-600">
                From
                <input
                  type="date"
                  value={clearFrom}
                  onChange={(e) => setClearFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="block text-xs text-slate-600">
                To
                <input
                  type="date"
                  value={clearTo}
                  min={clearFrom}
                  onChange={(e) => setClearTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none ring-blue-300 focus:ring-2"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowClearDayModal(false)}
                className="flex-1 rounded-md border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearDay}
                className="flex-1 rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src="/jasonos-mark.png" alt="CoSA" className="h-10 w-10 rounded-[22%]" />
            <div>
              <p className="text-sm text-slate-600">{activeScreenLabel}</p>
              {activeScreen === 'today' && todayTasks.length > 0 && queueDate ? (
                <p className="text-xs font-medium text-slate-500">
                  {queueDate > getTodayDateString()
                    ? `Tomorrow's Queue — ${formatQueueDate(queueDate)}`
                    : formatQueueDate(queueDate)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {session?.provider_token ? (
              gcalSyncStatus === 'auth-error' ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 font-medium hover:bg-rose-100"
                  title="Google Calendar access expired — click to reconnect"
                >
                  📅 Re-connect Calendar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSyncFromGCal}
                  disabled={gcalSyncStatus === 'syncing'}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    gcalSyncStatus === 'ok'
                      ? 'bg-emerald-100 text-emerald-700'
                      : gcalSyncStatus === 'error'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                  title="Pull latest changes from Google Calendar"
                >
                  {gcalSyncStatus === 'syncing' ? '📅 Syncing…' : gcalSyncStatus === 'ok' ? '📅 Synced ✓' : gcalSyncStatus === 'error' ? '📅 Sync failed' : '📅 Sync Calendar'}
                </button>
              )
            ) : supabaseConfigured && session ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 hover:bg-amber-100"
                title="Click to reconnect Google Calendar"
              >
                📅 Reconnect Calendar
              </button>
            ) : null}
            {supabaseConfigured && session?.user?.email ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{session.user.email}</span>
            ) : (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">Local mode (no Supabase env)</span>
            )}
            {supabaseConfigured && session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
        {!supabaseConfigured ? (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local` to enable Google login and sync.
          </p>
        ) : null}
      </section>
      {activeScreen === 'today' && gcalSyncStatus === 'auth-error' ? (
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>
            <strong>Google Calendar access expired.</strong> Changes you make in Google Calendar won&apos;t sync until you reconnect.
          </p>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="shrink-0 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Reconnect
          </button>
        </div>
      ) : null}
      {activeScreen === 'today' ? (
        <section className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        {todayTasks.length > 0 ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!hasActiveTodayTask ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <img src="/logo.png" alt="CoSA" className="h-56 w-auto opacity-80 mb-6" />
              <p className="text-sm font-medium text-slate-700">Tasks loaded from your calendar</p>
              <p className="mt-1 text-xs text-slate-400">Select a task from the queue on the right to start the timer.</p>
            </div>
          ) : (<>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Active Task</p>
              <h2 className="text-lg font-semibold">{activeTask.name}</h2>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: trackMeta?.color }}
            >
              {trackMeta?.label}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-100 p-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Estimate</p>
              <p className="font-medium">{formatDuration(activeSession.estimateSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="font-medium">{activeSession.timerState}</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-slate-900 p-4 text-center text-white">
            <p className="text-xs uppercase tracking-wide">
              {activeSession.remainingSeconds === 0 ? 'Time Up' : 'Remaining'}
            </p>
            <p className="text-4xl font-semibold tabular-nums">
              {formatDuration(activeSession?.remainingSeconds ?? 0)}
            </p>
            {activeSession.remainingSeconds === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {formatDuration(activeSession?.elapsedSeconds ?? 0)} elapsed
              </p>
            )}
          </div>

          <div className="mb-4 grid gap-2 grid-cols-2 sm:grid-cols-5">
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleStart}
              disabled={isCompleted || isCancelled}
            >
              <Play size={16} />
              Start / Resume
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed active:scale-95"
              onClick={handlePause}
              disabled={isCompleted || isCancelled || activeSession.timerState !== TIMER_STATES.running}
            >
              <Pause size={16} />
              Pause
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleComplete}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <SquareCheck size={16} />
              Complete
            </button>
            <button
              type="button"
              title={`Credit full ${activeTask.estimateMinutes}m regardless of elapsed time`}
              className="flex items-center justify-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              onClick={handleFullCredit}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <SquareCheck size={16} />
              Full Credit
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleCancel}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <StopCircle size={16} />
              Cancel
            </button>
          </div>

          {(() => {
            const activeSubtasks = (subtasksMap[activeTask.templateId] ?? []).filter((st) => st.text.trim())
            const trackKey = activeTask.track === 'jobsearch' ? 'jobSearch' : activeTask.track
            const kpiInputs = TRACK_KPI_INPUTS[trackKey] ?? []
            const showChecklist = activeSubtasks.length > 0
            const showKpis = kpiInputs.length > 0 && !isCompleted && !isCancelled
            if (!showChecklist && !showKpis) return null

            const vals = kpiSessionValues[activeTask.id] ?? {}
            const setKpiVal = (kpiId, value) =>
              setKpiSessionValues((prev) => ({
                ...prev,
                [activeTask.id]: { ...(prev[activeTask.id] ?? {}), [kpiId]: value },
              }))

            return (
              <div
                className={`mb-4 grid gap-4 ${showChecklist && showKpis ? 'md:grid-cols-2' : ''}`}
              >
                {showChecklist ? (
                  <div className="min-w-0 rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
                    <ul className="space-y-1">
                      {activeSubtasks.map((st) => {
                        const items = (st.items ?? []).filter((it) => it.text.trim())
                        const hasItems = items.length > 0
                        const taskChecks = subtaskChecks[activeTask.id] ?? {}
                        const taskExpanded = subtaskExpanded[activeTask.id] ?? {}

                        // Helper: update check state then test for full completion
                        const applyCheck = (nextChecks) => {
                          setSubtaskChecks((prev) => ({ ...prev, [activeTask.id]: nextChecks }))
                          // Auto-complete the task when every subtask/item is checked
                          const allDone = activeSubtasks.every((s) => {
                            const its = (s.items ?? []).filter((it) => it.text.trim())
                            if (its.length === 0) return nextChecks[s.id] ?? false
                            return its.every((it) => nextChecks[`${s.id}:${it.id}`] ?? false)
                          })
                          if (allDone) handleCompleteTask(activeTask.id)
                        }

                        if (!hasItems) {
                          // Plain checkbox subtask (no nested items)
                          const checked = taskChecks[st.id] ?? false
                          return (
                            <li key={st.id}>
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    applyCheck({ ...taskChecks, [st.id]: !checked })
                                  }}
                                  className="h-4 w-4 shrink-0 rounded accent-slate-900"
                                />
                                <span className={`text-sm ${checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {st.text}
                                </span>
                              </label>
                            </li>
                          )
                        }

                        // Subtask with nested checklist items — collapsible
                        const checkedCount = items.filter((it) => taskChecks[`${st.id}:${it.id}`] ?? false).length
                        const allItemsDone = checkedCount === items.length
                        const isExpanded = taskExpanded[st.id] ?? false

                        return (
                          <li key={st.id} className="rounded-md border border-slate-100">
                            {/* Subtask header — click to expand/collapse */}
                            <button
                              type="button"
                              onClick={() =>
                                setSubtaskExpanded((prev) => ({
                                  ...prev,
                                  [activeTask.id]: { ...(prev[activeTask.id] ?? {}), [st.id]: !isExpanded },
                                }))
                              }
                              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-50 rounded-md"
                            >
                              {isExpanded
                                ? <ChevronDown size={13} className="shrink-0 text-slate-400" />
                                : <ChevronRight size={13} className="shrink-0 text-slate-400" />
                              }
                              <span className={`flex-1 text-sm font-medium ${allItemsDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {st.text}
                              </span>
                              <span className={`shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                                allItemsDone
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : checkedCount > 0
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-500'
                              }`}>
                                {checkedCount}/{items.length}
                              </span>
                            </button>

                            {/* Expanded item list */}
                            {isExpanded && (
                              <ul className="border-t border-slate-100 px-2 py-1.5 space-y-1">
                                {items.map((item) => {
                                  const key = `${st.id}:${item.id}`
                                  const checked = taskChecks[key] ?? false
                                  return (
                                    <li key={item.id}>
                                      <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-0.5 hover:bg-slate-50">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => applyCheck({ ...taskChecks, [key]: !checked })}
                                          className="h-3.5 w-3.5 shrink-0 rounded accent-slate-700"
                                        />
                                        <span className={`text-xs ${checked ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                          {item.text}
                                        </span>
                                      </label>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}

                {showKpis ? (
                  <div className="min-w-0 rounded-lg border border-slate-200 p-3">
                    {/* No CSS uppercase — preserves "KPIs" (lowercase s) */}
                    <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500">KPIs THIS SESSION</p>
                    <div className="space-y-3">
                      {kpiInputs.map((kpi) => {
                        const val = vals[kpi.id] ?? null
                        if (kpi.type === 'count') {
                          return (
                            <div key={kpi.id}>
                              <p className="mb-1 text-xs text-slate-600">{kpi.label}</p>
                              <div className="flex flex-wrap items-center gap-1">
                                {kpi.quickCounts.map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setKpiVal(kpi.id, val === n ? null : n)}
                                    className={`h-7 w-7 rounded text-xs font-semibold transition ${val === n ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                  >{n}</button>
                                ))}
                                <input
                                  type="number"
                                  min={1}
                                  value={typeof val === 'number' && !kpi.quickCounts.includes(val) ? val : ''}
                                  placeholder="other"
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value, 10)
                                    setKpiVal(kpi.id, isNaN(n) || n < 1 ? null : n)
                                  }}
                                  className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-center text-xs outline-none focus:ring-1 focus:ring-slate-400"
                                />
                                {val != null && (
                                  <button
                                    type="button"
                                    onClick={() => setKpiVal(kpi.id, null)}
                                    className="text-xs text-slate-400 hover:text-slate-600"
                                    title="Clear"
                                  >✕</button>
                                )}
                              </div>
                            </div>
                          )
                        }
                        if (kpi.type === 'boolean') {
                          return (
                            <div key={kpi.id} className="flex items-center justify-between">
                              <p className="text-xs text-slate-600">{kpi.label}</p>
                              <button
                                type="button"
                                onClick={() => setKpiVal(kpi.id, val === true ? null : true)}
                                className={`rounded px-3 py-1 text-xs font-semibold transition ${val === true ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                              >YES</button>
                            </div>
                          )
                        }
                        if (kpi.type === 'venue') {
                          return (
                            <div key={kpi.id} className="flex items-center justify-between gap-2">
                              <p className="shrink-0 text-xs text-slate-600">{kpi.label}</p>
                              <select
                                value={val ?? ''}
                                onChange={(e) => setKpiVal(kpi.id, e.target.value || null)}
                                className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-slate-400"
                              >
                                <option value="">— none —</option>
                                {kpi.options.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })()}

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea
              value={completionInput}
              onChange={(event) => setCompletionInput(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none ring-blue-300 focus:ring-2"
              placeholder="What did you accomplish? Any blockers?"
              disabled={isCompleted || isCancelled}
            />
          </div>

          {statusMessage ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {statusMessage}
            </p>
          ) : null}
          </>)}
        </article>
        ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm flex flex-col items-center justify-center text-center">
          <img src="/logo.png" alt="CoSA" className="h-56 w-auto opacity-80 mb-6" />
          <h2 className="text-xl font-semibold text-slate-700">You&apos;re all clear</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xs">
            No tasks in today&apos;s queue. Tag calendar events with a track, or drag tasks from the <strong>Calendar</strong> view to get started.
          </p>
        </article>
        )}

        <aside className="space-y-4">
          <section
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setActiveTaskId(null) }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevDay}
                  disabled={!canScrollPrev()}
                  className="rounded px-1 py-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Previous day"
                >
                  ←
                </button>
                <h3 className="text-sm font-semibold uppercase text-slate-500">
                  {todayPreviewDate ? formatScrollLabel(todayPreviewDate) : 'Today Queue'}
                </h3>
                <button
                  type="button"
                  onClick={goToNextDay}
                  disabled={!canScrollNext()}
                  className="rounded px-1 py-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Next day"
                >
                  →
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {todayPreviewDate && (
                  <button
                    type="button"
                    onClick={() => setTodayPreviewDate(null)}
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  >
                    Back to Today
                  </button>
                )}
                {!todayPreviewDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setClearFrom(getTodayDateString())
                      setClearTo(getTodayDateString())
                      setShowClearDayModal(true)
                    }}
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  >
                    Clear Day
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReplanWeekFromToday}
                  className="rounded border border-blue-200 px-2 py-0.5 text-[11px] text-blue-500 hover:border-blue-300 hover:text-blue-700"
                >
                  Replan Week
                </button>
              </div>
            </div>

            {todayPreviewDate ? (
              <>
                <p className="mb-2 text-xs text-slate-400">Calendar preview — read only</p>
                {previewTasksLoading ? (
                  <p className="text-xs text-slate-400 italic">Loading…</p>
                ) : previewTasks && previewTasks.length > 0 ? (() => {
                  // Group by track, same as the live queue
                  const grouped = []
                  const seen = new Map()
                  for (const task of previewTasks) {
                    const meta = getTrackMeta(task.track ?? '')
                    const key = task.track ?? ''
                    if (!seen.has(key)) {
                      const entry = { track: meta ?? { key, label: key, color: '#94a3b8' }, tasks: [] }
                      seen.set(key, entry)
                      grouped.push(entry)
                    }
                    seen.get(key).tasks.push(task)
                  }
                  return grouped.map((group) => (
                    <div key={group.track.key} className="mb-3">
                      <p className="mb-1 text-xs font-semibold" style={{ color: group.track.color }}>
                        {group.track.label}
                      </p>
                      <ul className="space-y-1">
                        {group.tasks.map((task) => (
                          <li key={task.id} className="rounded-md border border-slate-200 bg-white px-2 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-slate-700">{task.name}</span>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: group.track.color }}
                              />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400">{task.estimateMinutes}m</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                })() : (
                  <p className="text-xs italic text-slate-400">No calendar events found for this day.</p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  {queueDate ? `Queue for: ${formatQueueDate(queueDate)}` : 'Today\'s Queue'}
                </p>
                {tasksByTrack.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tasks in queue.</p>
                ) : tasksByTrack.map((group) => (
                  <div key={group.track.key} className="mb-3">
                    <p className="mb-1 text-xs font-semibold" style={{ color: group.track.color }}>
                      {group.track.label}
                    </p>
                    <ul className="space-y-1">
                      {group.tasks.map((task) => {
                        const session = sessions[task.id]
                        const selected = task.id === activeTaskId
                        const isRunning   = session?.timerState === TIMER_STATES.running
                        const isDone      = session?.timerState === TIMER_STATES.completed
                        const isCxled     = session?.timerState === TIMER_STATES.cancelled
                        const cardCls = selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : isDone
                            ? 'border-emerald-200 bg-emerald-50 text-slate-400'
                            : isCxled
                              ? 'border-slate-100 bg-slate-50 text-slate-300'
                              : isRunning
                                ? 'border-emerald-400 bg-white text-slate-800'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                        return (
                          <li key={task.id}>
                            <div className="flex items-stretch gap-1">
                              <button
                                type="button"
                                onClick={() => setActiveTask(task.id)}
                                className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-left text-sm ${cardCls}`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className={`truncate flex-1 ${isDone || isCxled ? 'line-through' : ''}`}>{task.name}</span>
                                  {isRunning && !selected && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                                  )}
                                  {!isRunning && (
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.track.color }} />
                                  )}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs opacity-80">
                                  <span className={isRunning && !selected ? 'text-emerald-600 font-semibold' : ''}>
                                    {isRunning && !selected ? '● Running' : (session?.timerState ?? 'Not Started')}
                                  </span>
                                  <span>{task.estimateMinutes}m</span>
                                </div>
                              </button>

                              {/* Quick-complete button — hidden for already-terminal tasks */}
                              {!isDone && !isCxled && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteTask(task.id)}
                                  title="Mark complete"
                                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2 text-green-600 hover:bg-green-50 hover:border-green-300 text-base"
                                >
                                  ✓
                                </button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
                {/* Tap empty space below the list to deselect the active task */}
                {activeTaskId && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTaskId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveTaskId(null)}
                    className="mt-2 cursor-pointer rounded border border-dashed border-slate-100 py-3 text-center text-[11px] text-slate-300 hover:border-slate-200 hover:text-slate-400 transition-colors"
                    title="Click to deselect active task"
                  >
                    click to deselect
                  </div>
                )}
              </>
            )}
          </section>
        </aside>
      </section>
      ) : null}
      {activeScreen === 'taskLibrary' ? renderTaskLibrary() : null}
      {activeScreen === 'weekPlanner' ? (
        <WeekPlanner
          taskLibrary={taskLibrary}
          session={session}
          supabaseConfigured={supabaseConfigured}
          onTodayEventCreated={handleTodayEventCreated}
          onCalendarTagsUpdated={refreshCalendarEventTags}
          completionLog={completionLog}
        />
      ) : null}
      {activeScreen === 'kpi' ? renderKpiDashboard() : null}
      {activeScreen === 'nyui' ? <NYUIScreen /> : null}

      {/* ── Floating Quick Log button ─────────────────────────────────── */}
      <button
        type="button"
        onClick={openQuickLog}
        title="Quick Log"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-700 active:scale-95"
        aria-label="Open Quick Log"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </button>

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {quickLogToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Logged ✓
        </div>
      )}

      {/* ── Quick Log Modal ───────────────────────────────────────────── */}
      {showQuickLog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowQuickLog(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Quick Log</h2>
              <button type="button" onClick={() => setShowQuickLog(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-1">

              {/* Who */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Who was this with?</label>
                <input
                  type="text"
                  value={quickLogForm.who}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, who: e.target.value }))}
                  placeholder="Name or company"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900 ${quickLogErrors.who ? 'border-rose-400' : 'border-slate-200'}`}
                />
                {quickLogErrors.who && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.who}</p>}
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Type</label>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Coffee Chat', 'Message', 'Meeting', 'Event', 'Materials'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, activityType: t }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        quickLogForm.activityType === t
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {quickLogErrors.activityType && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.activityType}</p>}
              </div>

              {/* Track */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Track</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(TRACKS).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        const validMappings = QUICK_LOG_KPI_GROUPS.filter((g) => g.track === t.key).flatMap((g) => g.kpis.map((k) => k.mapping))
                        setQuickLogForm((f) => ({
                          ...f,
                          track: t.key,
                          subTrack: '',
                          kpiCredits: f.kpiCredits.filter((k) => validMappings.includes(k)),
                          kpiQuantities: Object.fromEntries(Object.entries(f.kpiQuantities).filter(([k]) => validMappings.includes(k))),
                        }))
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        quickLogForm.track === t.key
                          ? 'text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      style={quickLogForm.track === t.key ? { backgroundColor: t.color } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {quickLogErrors.track && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.track}</p>}
              </div>

              {/* Sub-track — only shown when the selected track has defined sub-tracks */}
              {quickLogForm.track && (TRACK_SUB_TRACKS[quickLogForm.track] ?? []).length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Sub-track <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    value={quickLogForm.subTrack}
                    onChange={(e) => setQuickLogForm((f) => ({ ...f, subTrack: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">— None —</option>
                    {(TRACK_SUB_TRACKS[quickLogForm.track] ?? []).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 60, 90].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, durationMinutes: m }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        quickLogForm.durationMinutes === m
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                {quickLogErrors.durationMinutes && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.durationMinutes}</p>}
              </div>

              {/* KPI Credits */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  KPI Credits <span className="font-normal text-slate-400">(optional)</span>
                </label>
                {quickLogForm.track && !QUICK_LOG_KPI_GROUPS.some((g) => g.track === quickLogForm.track) ? (
                  <p className="text-xs text-slate-400 italic">No KPI credits defined for this track.</p>
                ) : (
                <div className="space-y-3">
                  {QUICK_LOG_KPI_GROUPS.filter((grp) => !quickLogForm.track || grp.track === quickLogForm.track).map((grp) => (
                    <div key={grp.group}>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: grp.color }} />
                        {grp.group}
                      </p>
                      <div className="space-y-1">
                        {grp.kpis.map((kpiRow) => {
                          const mapping = typeof kpiRow === 'string' ? kpiRow : kpiRow.mapping
                          const label = typeof kpiRow === 'string' ? kpiRow : kpiRow.label
                          const checked = quickLogForm.kpiCredits.includes(mapping)
                          const isCountable = true // all Quick Log KPIs support a quantity
                          const qty = quickLogForm.kpiQuantities[mapping] ?? 1
                          return (
                            <div key={mapping} className="flex items-center gap-2">
                              <label className="flex flex-1 cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setQuickLogForm((f) => ({
                                      ...f,
                                      kpiCredits: checked
                                        ? f.kpiCredits.filter((k) => k !== mapping)
                                        : [...f.kpiCredits, mapping],
                                      kpiQuantities: checked
                                        ? (({ [mapping]: _, ...rest }) => rest)(f.kpiQuantities)
                                        : { ...f.kpiQuantities, [mapping]: f.kpiQuantities[mapping] ?? 1 },
                                    }))
                                  }
                                  className="h-3.5 w-3.5 rounded accent-slate-900"
                                />
                                <span className="text-xs text-slate-700">{label}</span>
                              </label>
                              {/* Quantity stepper — only for countable KPIs when checked */}
                              {checked && isCountable && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setQuickLogForm((f) => ({ ...f, kpiQuantities: { ...f.kpiQuantities, [mapping]: Math.max(1, qty - 1) } }))}
                                    className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-100"
                                  >−</button>
                                  <span className="w-6 text-center text-xs font-medium text-slate-800">{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => setQuickLogForm((f) => ({ ...f, kpiQuantities: { ...f.kpiQuantities, [mapping]: qty + 1 } }))}
                                    className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-100"
                                  >+</button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  One-line note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={quickLogForm.note}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Former OUTFRONT colleague, also alpha tester"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowQuickLog(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickLogSubmit}
                disabled={quickLogSubmitting}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {quickLogSubmitting ? 'Logging…' : 'Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <ul className="mx-auto grid w-full max-w-lg grid-cols-5 gap-1 p-2 text-center text-xs sm:text-sm">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`block w-full rounded-md px-1 py-2 ${
                  item.id === activeScreen
                    ? 'bg-slate-900 font-semibold text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}

export default App
