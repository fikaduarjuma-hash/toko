import { useEffect, useRef, useState } from 'react';
import type { OEMSData, ExamQuestion, Examination } from './types';

/* ------------------------------------------------------------ helpers -- */
const API_ORIGIN = String((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/$/, '');
const TOKEN_KEY = 'oems_auth_token';
const USER_KEY = 'oems_auth_user';

async function api(method: string, path: string, body?: unknown): Promise<any> {
  if (!API_ORIGIN) return { success: false, error: 'The backend API URL is not configured. Set VITE_API_URL to your deployed API address and rebuild the frontend.' };
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(`${API_ORIGIN}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await r.json().catch(() => ({ success: false, error: `The API returned an unreadable response (${r.status}). Check the backend deployment and API URL.` }));
    if (!r.ok && payload?.success !== false) return { success: false, error: payload?.error || `Request failed (${r.status})` };
    if (payload?.success && path.startsWith('/login/') && payload.token) {
      window.localStorage.setItem(TOKEN_KEY, payload.token);
    }
    return payload;
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error. Check your internet connection and API URL.' };
  }
}

const emptyData = (): OEMSData => ({
  school: { name: 'Online Examination Management System', motto: '', academicYear: '', term: '', address: '', contactEmail: '', contactPhone: '' },
  students: [], exams: [], attempts: [], auditLogs: [],
});

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btn = 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const btn2 = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50';
const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const fmt = (s: string) => (s ? new Date(s).toLocaleString() : '-');
const mmss = (t: number) => `${Math.floor(Math.max(t, 0) / 60)}:${String(Math.max(t, 0) % 60).padStart(2, '0')}`;

/* ---------------------------------------------------------------- app -- */
export default function App() {
  const [data, setData] = useState<OEMSData | null>(null);
  const [user, setUser] = useState<any>(() => {
    if (!window.localStorage.getItem(TOKEN_KEY)) return null;
    try { return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  const [err, setErr] = useState('');

  const reload = async () => {
    const r = await api('GET', '/bootstrap');
    if (r.success) {
      setData(r.data);
      setErr('');
    } else {
      setData(emptyData());
      setErr(r.error || 'Could not load data.');
      if (r.error?.toLowerCase().includes('session') || r.error?.toLowerCase().includes('sign in')) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        setUser(null);
      }
    }
  };
  const handleLogin = async (nextUser: any) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    await reload();
  };
  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    setData(emptyData());
    setErr('');
  };
  useEffect(() => {
    if (window.localStorage.getItem(TOKEN_KEY) && user) reload();
    else setData(emptyData());
  }, []);

  if (!data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        {err ? `Error: ${err}` : 'Loading…'}
      </div>
    );

  if (!user) return <Login data={data} onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-indigo-700 px-4 py-3 text-white">
        <div>
          <div className="font-bold">{data.school.name}</div>
          <div className="text-xs text-indigo-200">
            {data.school.term} • {data.school.academicYear}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {user.fullName} ({user.role})
          </span>
          <button className="rounded bg-white/20 px-3 py-1 hover:bg-white/30" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        {err && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {user.role === 'admin' ? <Admin data={data} reload={reload} /> : <StudentArea data={data} user={user} reload={reload} />}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------- login -- */
function Login({ data, onLogin }: { data: OEMSData; onLogin: (u: any) => void }) {
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await api('POST', `/login/${role}`, { username, password });
    setBusy(false);
    if (r.success) onLogin(r.user);
    else setError(r.error || 'Login failed.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-700 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-800">{data.school.name}</h1>
          <p className="text-xs text-slate-500">{data.school.motto}</p>
          <p className="mt-1 text-sm font-semibold text-indigo-700">Online Examination System</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(['student', 'admin'] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md py-1.5 capitalize ${role === r ? 'bg-white font-semibold shadow' : 'text-slate-500'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Username or Student ID">
          <input className={inp} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="Password">
          <input className={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <button className={btn + ' w-full'} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------- admin -- */
const TABS = ['Dashboard', 'Students', 'Exams', 'Results', 'School', 'Audit'] as const;

function Admin({ data, reload }: { data: OEMSData; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Dashboard');
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Dashboard' && <Dashboard data={data} />}
      {tab === 'Students' && <Students data={data} reload={reload} />}
      {tab === 'Exams' && <Exams data={data} reload={reload} />}
      {tab === 'Results' && <Results data={data} reload={reload} />}
      {tab === 'School' && <School data={data} reload={reload} />}
      {tab === 'Audit' && <Audit data={data} />}
    </div>
  );
}

function Dashboard({ data }: { data: OEMSData }) {
  const done = data.attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
  const avg = done.length ? Math.round(done.reduce((s, a) => s + a.percentage, 0) / done.length) : 0;
  const stats = [
    ['Students', data.students.length],
    ['Exams', data.exams.length],
    ['Active exams', data.exams.filter((e) => e.status === 'active').length],
    ['Submissions', done.length],
    ['Average score', avg + '%'],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {stats.map(([l, v]) => (
        <div key={l} className={card}>
          <div className="text-xs text-slate-500">{l}</div>
          <div className="text-2xl font-bold text-indigo-700">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Students({ data, reload }: { data: OEMSData; reload: () => Promise<void> }) {
  const empty = { fullName: '', username: '', password: '', classGrade: '', gender: 'Male', email: '' };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState('');
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api('POST', '/students', f);
    if (r.success) {
      setF(empty);
      setMsg('Student added.');
      reload();
    } else setMsg(r.error || 'Failed.');
  };
  const toggle = async (id: string, status: string) => {
    const r = await api('POST', `/students/${id}/status`, { status: status === 'active' ? 'deactivated' : 'active' });
    if (!r.success) return setMsg(r.error || 'Could not update student status.');
    setMsg('Student status updated.');
    await reload();
  };
  const reset = async (id: string) => {
    const p = window.prompt('New password:', 'student123');
    if (p) {
      const r = await api('POST', `/students/${id}/reset-password`, { newPassword: p });
      setMsg(r.success ? 'Password reset.' : (r.error || 'Password reset failed.'));
    }
  };
  const del = async (id: string) => {
    if (window.confirm('Delete this student?')) {
      const r = await api('DELETE', `/students/${id}`);
      if (!r.success) return setMsg(r.error || 'Could not delete student.');
      setMsg('Student deleted.');
      await reload();
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className={card + ' grid gap-3 md:grid-cols-3'}>
        <Field label="Full name"><input className={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required /></Field>
        <Field label="Username"><input className={inp} value={f.username} onChange={(e) => set('username', e.target.value)} required /></Field>
        <Field label="Initial password (minimum 8 characters)"><input className={inp} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} required minLength={8} /></Field>
        <Field label="Class / Grade"><input className={inp} value={f.classGrade} onChange={(e) => set('classGrade', e.target.value)} /></Field>
        <Field label="Gender">
          <select className={inp} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </Field>
        <Field label="Email"><input className={inp} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <div className="flex items-center gap-3 md:col-span-3">
          <button className={btn}>Add student</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </form>
      <div className={card + ' overflow-x-auto'}>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="p-2">ID</th><th>Name</th><th>Username</th><th>Class</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-2">{s.studentId}</td>
                <td>{s.fullName}</td>
                <td>{s.username}</td>
                <td>{s.classGrade}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                </td>
                <td className="space-x-1 py-2">
                  <button className={btn2} onClick={() => toggle(s.id, s.status)}>{s.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className={btn2} onClick={() => reset(s.id)}>Reset password</button>
                  <button className={btn2} onClick={() => del(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- exams -- */
function Exams({ data, reload }: { data: OEMSData; reload: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const setStatus = async (id: string, status: string) => {
    const r = await api('POST', `/exams/${id}/status`, { status });
    if (!r.success) return setMsg(r.error || 'Could not update exam status.');
    setMsg('Exam status updated.');
    await reload();
  };
  const del = async (id: string) => {
    if (window.confirm('Delete this exam?')) {
      const r = await api('DELETE', `/exams/${id}`);
      if (!r.success) return setMsg(r.error || 'Could not delete exam.');
      setMsg('Exam deleted.');
      await reload();
    }
  };
  if (creating)
    return (
      <ExamForm
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          reload();
        }}
      />
    );
  return (
    <div className="space-y-3">
      <button className={btn} onClick={() => setCreating(true)}>+ New exam</button>
      {msg && <p role="status" className="text-sm text-slate-600">{msg}</p>}
      {data.exams.map((e) => (
        <div key={e.id} className={card + ' flex flex-wrap items-center justify-between gap-3'}>
          <div>
            <div className="font-semibold">{e.title}</div>
            <div className="text-xs text-slate-500">
              {e.subject} • {e.targetClass} • {e.questions.length} questions • {e.totalMarks} marks • pass {e.passMarks} • {e.durationMinutes} min
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>
              <option value="draft">draft</option><option value="active">active</option>
              <option value="closed">closed</option><option value="cancelled">cancelled</option>
            </select>
            <button className={btn2} onClick={() => del(e.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const EXAM_DRAFT_KEY = 'oems_exam_import_draft_v1';

function readExamDraft(): any {
  try {
    const raw = window.localStorage.getItem(EXAM_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ExamForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [initialDraft] = useState(() => readExamDraft());
  const [f, setF] = useState(() => initialDraft?.f || {
    title: '', subject: '', targetClass: 'All', instructions: '', date: new Date().toISOString().split('T')[0],
    startTime: '08:00', durationMinutes: 45, closingTime: '23:59', passPercent: 50,
  });
  const [qs, setQs] = useState<ExamQuestion[]>(() => Array.isArray(initialDraft?.qs) ? initialDraft.qs : []);
  const [rawText, setRawText] = useState(() => initialDraft?.rawText || '');
  const [pdf, setPdf] = useState<string>('');
  const [marks, setMarks] = useState(() => Number(initialDraft?.marks) || 5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [mq, setMq] = useState({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });

  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  // Persist imported/manual questions while the exam is still being drafted.
  useEffect(() => {
    try {
      window.localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify({ f, qs, rawText, marks }));
    } catch (error) {
      console.warn('[OEMS] Could not persist exam draft:', error);
      setMsg('Draft could not be saved in this browser. Please save the exam before leaving this page.');
    }
  }, [f, qs, rawText, marks]);

  const onFile = (file?: File) => {
    if (!file) return setPdf('');
    const rd = new FileReader();
    rd.onload = () => setPdf(String(rd.result));
    rd.readAsDataURL(file);
  };

  const extract = async () => {
    setBusy(true);
    setMsg('Extracting questions…');
    const r = await api('POST', '/import-questions-gemini', {
      base64Pdf: pdf || undefined, rawText: pdf ? undefined : rawText, subjectHint: f.subject, defaultMarks: marks,
    });
    setBusy(false);
    if (r.success) {
      setQs((old) => [...old, ...r.questions].map((q, i) => ({ ...q, questionNumber: i + 1 })));
      setMsg(`Added ${r.questions.length} questions.${r.warning ? ' ' + r.warning : ''} Please review the answers.`);
    } else setMsg(r.error || 'Extraction failed.');
  };

  const addManual = () => {
    if (!mq.text.trim()) return;
    const options = [mq.a, mq.b, mq.c, mq.d]
      .map((t, i) => ({ id: `opt_${i + 1}`, label: 'ABCD'[i], text: t }))
      .filter((o) => o.text.trim());
    const q: ExamQuestion = {
      id: `q_${Date.now()}`, questionNumber: qs.length + 1, type: 'multiple_choice',
      text: mq.text, options, correctAnswer: mq.correct, marks,
    };
    setQs([...qs, q]);
    setMq({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });
  };

  const save = async () => {
    if (!f.title.trim() || qs.length === 0) return setMsg('Enter a title and add at least one question.');
    const total = qs.reduce((s, q) => s + (q.marks || 0), 0);
    const { passPercent, ...rest } = f;
    const r = await api('POST', '/exams', {
      ...rest, durationMinutes: Number(f.durationMinutes), questions: qs, totalMarks: total,
      passMarks: Math.round((total * Number(passPercent)) / 100), status: 'active', showResultsImmediately: true,
    } as Partial<Examination>);
    if (r.success) {
      try { window.localStorage.removeItem(EXAM_DRAFT_KEY); } catch { /* ignore */ }
      onSaved();
    } else setMsg(r.error || 'Could not save.');
  };

  return (
    <div className="space-y-4">
      <div className={card + ' grid gap-3 md:grid-cols-3'}>
        <Field label="Title"><input className={inp} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Subject"><input className={inp} value={f.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
        <Field label="Target class (or All)"><input className={inp} value={f.targetClass} onChange={(e) => set('targetClass', e.target.value)} /></Field>
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Duration (minutes)"><input type="number" className={inp} value={f.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} /></Field>
        <Field label="Pass mark (%)"><input type="number" className={inp} value={f.passPercent} onChange={(e) => set('passPercent', e.target.value)} /></Field>
        <div className="md:col-span-3">
          <Field label="Instructions"><textarea className={inp} rows={3} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} /></Field>
        </div>
      </div>

      <div className={card + ' space-y-3'}>
        <h3 className="font-semibold">Import questions (PDF or pasted text)</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="PDF file"><input type="file" accept="application/pdf" className={inp} onChange={(e) => onFile(e.target.files?.[0])} /></Field>
          <Field label="Marks per question"><input type="number" className={inp} value={marks} onChange={(e) => setMarks(Number(e.target.value) || 1)} /></Field>
        </div>
        <Field label="…or paste question text"><textarea className={inp} rows={4} value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder={'1. Question?\nA. one\nB. two'} /></Field>
        <button className={btn} disabled={busy || (!pdf && !rawText.trim())} onClick={extract}>Extract with AI</button>
      </div>

      <div className={card + ' space-y-3'}>
        <h3 className="font-semibold">Add a question manually</h3>
        <input className={inp} placeholder="Question text" value={mq.text} onChange={(e) => setMq({ ...mq, text: e.target.value })} />
        <div className="grid gap-2 md:grid-cols-4">
          {(['a', 'b', 'c', 'd'] as const).map((k) => (
            <input key={k} className={inp} placeholder={`Option ${k.toUpperCase()}`} value={mq[k]} onChange={(e) => setMq({ ...mq, [k]: e.target.value })} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select className="rounded border border-slate-300 px-2 py-1.5 text-sm" value={mq.correct} onChange={(e) => setMq({ ...mq, correct: e.target.value })}>
            {['A', 'B', 'C', 'D'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="text-xs text-slate-500">correct answer</span>
          <button className={btn2} onClick={addManual}>Add question</button>
        </div>
      </div>

      <div className={card + ' space-y-2'}>
        <h3 className="font-semibold">Questions ({qs.length})</h3>
        {qs.map((q, i) => (
          <div key={q.id} className="rounded border border-slate-200 p-2 text-sm">
            <div className="flex justify-between gap-2">
              <div className="font-medium">{i + 1}. {q.text}</div>
              <button className="text-xs text-red-600" onClick={() => setQs(qs.filter((x) => x.id !== q.id).map((x, n) => ({ ...x, questionNumber: n + 1 })))}>remove</button>
            </div>
            <ul className="ml-4 text-slate-600">
              {q.options.map((o) => (
                <li key={o.id} className={o.label === q.correctAnswer ? 'font-semibold text-emerald-700' : ''}>{o.label}. {o.text}</li>
              ))}
            </ul>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              Correct:
              <select className="rounded border border-slate-300 px-1" value={q.correctAnswer} onChange={(e) => setQs(qs.map((x) => (x.id === q.id ? { ...x, correctAnswer: e.target.value } : x)))}>
                {(q.options.length ? q.options.map((o) => o.label) : ['A']).map((l) => <option key={l}>{l}</option>)}
              </select>
              • {q.marks} marks
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button className={btn} onClick={save}>Save exam</button>
        <button className={btn2} onClick={onClose}>Cancel</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- results / misc -- */
function Results({ data, reload }: { data: OEMSData; reload: () => Promise<void> }) {
  const title = (id: string) => data.exams.find((e) => e.id === id)?.title || id;
  const reset = async (id: string) => {
    const reason = window.prompt('Reason for allowing a retake:', 'Authorized retake');
    if (reason !== null) {
      await api('POST', `/results/${id}/reset`, { reason });
      reload();
    }
  };
  return (
    <div className={card + ' overflow-x-auto'}>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr><th className="p-2">Student</th><th>Exam</th><th>Score</th><th>%</th><th>Result</th><th>Status</th><th>Submitted</th><th></th></tr>
        </thead>
        <tbody>
          {data.attempts.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="p-2">{a.studentName}</td>
              <td>{title(a.examId)}</td>
              <td>{a.score}/{a.totalMarks}</td>
              <td>{a.percentage}%</td>
              <td>{a.status === 'in_progress' ? '-' : a.passed ? 'Pass' : 'Fail'}</td>
              <td>{a.status}</td>
              <td>{fmt(a.submittedAt)}</td>
              <td>{(a.status === 'submitted' || a.status === 'graded') && <button className={btn2} onClick={() => reset(a.id)}>Allow retake</button>}</td>
            </tr>
          ))}
          {data.attempts.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={8}>No attempts yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function School({ data, reload }: { data: OEMSData; reload: () => Promise<void> }) {
  const [s, setS] = useState(data.school);
  const [msg, setMsg] = useState('');
  const keys: [keyof typeof s, string][] = [
    ['name', 'School name'], ['motto', 'Motto'], ['academicYear', 'Academic year'], ['term', 'Term'],
    ['address', 'Address'], ['contactEmail', 'Email'], ['contactPhone', 'Phone'],
  ];
  const save = async () => {
    const r = await api('POST', '/school', s);
    setMsg(r.success ? 'Saved.' : r.error || 'Failed.');
    reload();
  };
  return (
    <div className={card + ' space-y-3'}>
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map(([k, l]) => (
          <Field key={k} label={l}><input className={inp} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className={btn} onClick={save}>Save</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}

function Audit({ data }: { data: OEMSData }) {
  return (
    <div className={card + ' space-y-1 text-sm'}>
      {data.auditLogs.slice(0, 100).map((l) => (
        <div key={l.id} className="border-b border-slate-100 py-1">
          <span className="text-xs text-slate-400">{fmt(l.timestamp)}</span> <b>{l.actor}</b> • {l.action} — {l.details}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ student -- */
function StudentArea({ data, user, reload }: { data: OEMSData; user: any; reload: () => Promise<void> }) {
  const me = user.student;
  const [taking, setTaking] = useState<{ exam: any; attempt: any } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const start = async (id: string) => {
    setError('');
    const r = await api('POST', `/exams/${id}/start`, { studentId: me.id });
    if (r.success) setTaking({ exam: r.exam, attempt: r.attempt });
    else setError(r.error || 'Cannot start exam.');
  };

  if (taking)
    return (
      <TakeExam
        exam={taking.exam}
        attempt={taking.attempt}
        onDone={(r) => {
          setTaking(null);
          setResult(r);
          reload();
        }}
      />
    );
  if (result) return <ResultView r={result} onBack={() => setResult(null)} />;

  const mine = data.attempts.filter((a) => a.studentId === me.id && a.status !== 'reset_archived');
  const exams = data.exams.filter((e) => e.status === 'active' && (!e.targetClass || e.targetClass === 'All' || e.targetClass === me.classGrade));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Available examinations</h2>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {exams.length === 0 && <p className="text-sm text-slate-500">No active examinations right now.</p>}
      {exams.map((e) => {
        const att = mine.find((a) => a.examId === e.id);
        const submitted = att && (att.status === 'submitted' || att.status === 'graded');
        return (
          <div key={e.id} className={card + ' flex flex-wrap items-center justify-between gap-3'}>
            <div>
              <div className="font-semibold">{e.title}</div>
              <div className="text-xs text-slate-500">{e.subject} • {e.questions.length} questions • {e.totalMarks} marks • {e.durationMinutes} min</div>
              {submitted && <div className="mt-1 text-sm">Submitted — {att!.score}/{att!.totalMarks} ({att!.percentage}%) {att!.passed ? '✅ Passed' : '❌ Failed'}</div>}
            </div>
            {!submitted && <button className={btn} onClick={() => start(e.id)}>{att ? 'Resume exam' : 'Start exam'}</button>}
          </div>
        );
      })}
    </div>
  );
}

function TakeExam({ exam, attempt, onDone }: { exam: any; attempt: any; onDone: (r: any) => void }) {
  const startMs = new Date(attempt.startedAt).getTime();
  const elapsed = () => Math.floor((Date.now() - startMs) / 1000);
  const [answers, setAnswers] = useState<Record<string, string>>(attempt.answers || {});
  const [left, setLeft] = useState(() => exam.durationMinutes * 60 - elapsed());
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const ref = useRef(answers);
  ref.current = answers;
  const finished = useRef(false);

  const submit = async () => {
    if (finished.current) return;
    finished.current = true;
    setBusy(true);
    const r = await api('POST', `/exams/${exam.id}/submit`, { attemptId: attempt.id, answers: ref.current, timeSpentSeconds: elapsed() });
    setBusy(false);
    if (r.success) onDone(r);
    else { finished.current = false; setSubmitError(r.error || 'Submission failed. Your answers remain on this screen; please retry.'); }
  };

  useEffect(() => {
    const t = setInterval(() => setLeft(exam.durationMinutes * 60 - elapsed()), 1000);
    const s = setInterval(() => {
      if (!finished.current) api('POST', `/exams/${exam.id}/save-progress`, { attemptId: attempt.id, answers: ref.current, timeSpentSeconds: elapsed() });
    }, 15000);
    return () => {
      clearInterval(t);
      clearInterval(s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (left <= 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const answered = Object.keys(answers).length;
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-white p-3 shadow">
        <div>
          <div className="font-semibold">{exam.title}</div>
          <div className="text-xs text-slate-500">{answered}/{exam.questions.length} answered</div>
        </div>
        <div className={`text-xl font-bold ${left < 120 ? 'text-red-600' : 'text-indigo-700'}`}>{mmss(left)}</div>
      </div>
      {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
      {exam.instructions && <pre className={card + ' whitespace-pre-wrap font-sans text-sm text-slate-600'}>{exam.instructions}</pre>}
      {exam.questions.map((q: ExamQuestion, i: number) => (
        <div key={q.id} className={card}>
          <div className="mb-2 font-medium">{i + 1}. {q.text} <span className="text-xs text-slate-400">({q.marks} marks)</span></div>
          {q.type === 'short_answer' ? (
            <input className={inp} value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          ) : (
            <div className="space-y-1">
              {q.options.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${answers[q.id] === o.label ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                  <input type="radio" name={q.id} checked={answers[q.id] === o.label} onChange={() => setAnswers({ ...answers, [q.id]: o.label })} />
                  <b>{o.label}.</b> {o.text}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        className={btn}
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Submit now? ${answered}/${exam.questions.length} answered. You cannot change answers after submitting.`)) submit();
        }}
      >
        {busy ? 'Submitting…' : 'Submit exam'}
      </button>
    </div>
  );
}

function ResultView({ r, onBack }: { r: any; onBack: () => void }) {
  if (!r?.success)
    return (
      <div className={card}>
        <p className="text-red-700">{r?.error || 'Submission failed.'}</p>
        <button className={btn + ' mt-3'} onClick={onBack}>Back</button>
      </div>
    );
  const show = r.exam?.questions;
  return (
    <div className="space-y-4">
      <div className={card + ' text-center'}>
        <div className="text-sm text-slate-500">Exam submitted</div>
        {show ? (
          <>
            <div className="text-4xl font-bold text-indigo-700">{r.score}/{r.totalPossible}</div>
            <div className="text-lg">{r.percentage}% — {r.passed ? '✅ Passed' : '❌ Failed'}</div>
          </>
        ) : (
          <div className="mt-2">Your answers were recorded. Results will be released by your administrator.</div>
        )}
        <button className={btn + ' mt-3'} onClick={onBack}>Back to exams</button>
      </div>
      {show &&
        r.exam.questions.map((q: ExamQuestion, i: number) => {
          const mine = r.attempt.answers[q.id];
          const right = mine && mine.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
          return (
            <div key={q.id} className={card + (right ? ' border-emerald-300' : ' border-red-300')}>
              <div className="font-medium">{i + 1}. {q.text}</div>
              <div className="text-sm">Your answer: <b>{mine || '—'}</b> • Correct: <b>{q.correctAnswer}</b></div>
              {q.explanation && <div className="mt-1 text-xs text-slate-500">{q.explanation}</div>}
            </div>
          );
        })}
    </div>
  );
}