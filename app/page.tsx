 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Flame, LayoutDashboard, ListTodo, Menu, Plus, Settings2, Target, TimerReset, TrendingUp, X } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Task = { id: string; title: string; subject: string; priority: "High" | "Medium" | "Low"; done: boolean; created_at?: string };
type Subject = { id: string; name: string; code: string; progress: number };
type Session = { id: string; minutes: number; completed_at: string };
type View = "overview" | "tasks" | "subjects" | "analytics";
const starterSubjects: Subject[] = [
  { id: "s1", name: "Engineering Mathematics", code: "MATH", progress: 42 },
  { id: "s2", name: "Programming in C", code: "CODE", progress: 68 },
  { id: "s3", name: "Applied Physics", code: "PHYS", progress: 35 },
  { id: "s4", name: "Basic Electronics", code: "ELEC", progress: 54 },
];
const starterTasks: Task[] = [
  { id: "t1", title: "Review lecture notes", subject: "Engineering Mathematics", priority: "High", done: false },
  { id: "t2", title: "Solve 5 practice problems", subject: "Programming in C", priority: "High", done: false },
  { id: "t3", title: "Revise yesterday's concepts", subject: "Applied Physics", priority: "Medium", done: true },
  { id: "t4", title: "Read the next chapter", subject: "Basic Electronics", priority: "Medium", done: false },
];
const today = () => new Date().toLocaleDateString("en-CA");
const minsLabel = (n: number) => n >= 60 ? `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m` : `${n}m`;
const subjectColors = ["#e9b66e", "#a9b9a0", "#c89b83", "#b0a4c7", "#88b9c2"];

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [tasks, setTasks] = useState<Task[]>(starterTasks);
  const [subjects, setSubjects] = useState<Subject[]>(starterSubjects);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState(starterSubjects[0].name);
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("Medium");
  const [subjectName, setSubjectName] = useState("");
  const [target, setTarget] = useState(180);
  const [selectedSubject, setSelectedSubject] = useState("s1");
  const [progressValue, setProgressValue] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(75);
  const [seconds, setSeconds] = useState(75 * 60);
  const [running, setRunning] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced" | "error">("local");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const persistLocal = useCallback((next: { tasks: Task[]; subjects: Subject[]; sessions: Session[]; target: number }) => {
    try { localStorage.setItem("obsidian-study-data", JSON.stringify(next)); } catch {}
  }, []);

  const loadCloud = useCallback(async (email?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? email ?? null);
      setSyncState("syncing");
      const [taskResult, subjectResult, sessionResult] = await Promise.all([
        supabase.from("study_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("study_subjects").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("study_sessions").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(200)
      ]);
      if (taskResult.error || subjectResult.error || sessionResult.error) throw new Error("Cloud tables not ready. Run supabase/schema.sql.");
      if (taskResult.data) setTasks(taskResult.data.map((r: any) => ({ id: r.id, title: r.title, subject: r.subject ?? "General", priority: r.priority ?? "Medium", done: r.done })));
      if (subjectResult.data?.length) setSubjects(subjectResult.data.map((r: any) => ({ id: r.id, name: r.name, code: r.code ?? r.name.slice(0,4).toUpperCase(), progress: r.progress ?? 0 })));
      if (sessionResult.data) setSessions(sessionResult.data.map((r: any) => ({ id: r.id, minutes: r.minutes, completed_at: r.completed_at })));
      setSyncState("synced");
    } catch (e) {
      setSyncState("error");
      setAuthMessage(e instanceof Error ? e.message : "Could not load cloud data.");
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("obsidian-study-data");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.subjects) setSubjects(parsed.subjects);
        if (parsed.sessions) setSessions(parsed.sessions);
        if (parsed.target) setTarget(parsed.target);
      }
    } catch {}
    if (isSupabaseConfigured) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) void loadCloud(data.user.email ?? undefined);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void loadCloud(session.user.email ?? undefined);
        else { setUserEmail(null); setSyncState("local"); }
      });
      return () => listener.subscription.unsubscribe();
    }
  }, [loadCloud]);

  useEffect(() => { persistLocal({ tasks, subjects, sessions, target }); }, [tasks, subjects, sessions, target, persistLocal]);
  useEffect(() => {
    const chosen = subjects.find(s => s.id === selectedSubject);
    if (chosen) setProgressValue(chosen.progress);
    else if (subjects[0]) setSelectedSubject(subjects[0].id);
  }, [selectedSubject, subjects]);

  const pushTask = async (task: Task) => {
    if (!isSupabaseConfigured || !userEmail) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("study_tasks").upsert({ id: task.id, user_id: user.id, title: task.title, subject: task.subject, priority: task.priority, done: task.done });
    if (error) { setSyncState("error"); notify("Saved locally; cloud sync failed."); } else setSyncState("synced");
  };
  const updateTask = (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    void pushTask(task);
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const task: Task = { id: crypto.randomUUID(), title: taskTitle.trim(), subject: taskSubject || "General", priority: taskPriority, done: false };
    setTasks(prev => [task, ...prev]); setTaskTitle("");
    if (isSupabaseConfigured && userEmail) {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("study_tasks").insert({ id: task.id, user_id: user.id, title: task.title, subject: task.subject, priority: task.priority, done: false });
        if (error) { setSyncState("error"); notify("Task saved locally; sync failed."); return; }
        setSyncState("synced");
      }
    }
    notify("Task added to your plan.");
  };
  const addSubject = async () => {
    if (!subjectName.trim() || subjects.some(s => s.name.toLowerCase() === subjectName.trim().toLowerCase())) return;
    const subject: Subject = { id: crypto.randomUUID(), name: subjectName.trim(), code: subjectName.trim().slice(0,4).toUpperCase(), progress: 0 };
    setSubjects(prev => [...prev, subject]); setSubjectName("");
    if (isSupabaseConfigured && userEmail) {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
      if (user) { const { error } = await supabase.from("study_subjects").insert({ id: subject.id, user_id: user.id, name: subject.name, code: subject.code, progress: 0 }); if (error) setSyncState("error"); else setSyncState("synced"); }
    }
    notify("Subject added.");
  };
  const saveProgress = async () => {
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return;
    const updated = { ...subject, progress: progressValue };
    setSubjects(prev => prev.map(s => s.id === selectedSubject ? updated : s));
    if (isSupabaseConfigured && userEmail) {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
      if (user) { const { error } = await supabase.from("study_subjects").upsert({ id: updated.id, user_id: user.id, name: updated.name, code: updated.code, progress: updated.progress }); if (error) setSyncState("error"); else setSyncState("synced"); }
    }
    notify("Subject progress saved.");
  };

  const finishSession = async () => {
    const session: Session = { id: crypto.randomUUID(), minutes: timerMinutes, completed_at: new Date().toISOString() };
    setSessions(prev => [session, ...prev]);
    if (isSupabaseConfigured && userEmail) {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
      if (user) { const { error } = await supabase.from("study_sessions").insert({ id: session.id, user_id: user.id, minutes: session.minutes, completed_at: session.completed_at }); if (error) setSyncState("error"); else setSyncState("synced"); }
    }
    notify("Session complete. Take a 15-minute break.");
  };
  useEffect(() => {
    if (!running) { if (interval.current) clearInterval(interval.current); return; }
    interval.current = setInterval(() => setSeconds(s => {
      if (s <= 1) { if (interval.current) clearInterval(interval.current); setRunning(false); void finishSession(); return 0; }
      return s - 1;
    }), 1000);
    return () => { if (interval.current) clearInterval(interval.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const completed = tasks.filter(t => t.done).length;
  const openTasks = tasks.filter(t => !t.done);
  const dailySessions = sessions.filter(s => new Date(s.completed_at).toLocaleDateString("en-CA") === today());
  const focusToday = dailySessions.reduce((n,s) => n+s.minutes, 0);
  const totalFocus = sessions.reduce((n,s) => n+s.minutes, 0);
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const week = useMemo(() => {
    const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7));
    return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); const key=d.toLocaleDateString("en-CA"); return { label:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], minutes:sessions.filter(s=>new Date(s.completed_at).toLocaleDateString("en-CA")===key).reduce((n,s)=>n+s.minutes,0), current:key===today() }; });
  }, [sessions]);
  const maxWeek = Math.max(60,...week.map(d=>d.minutes));
  const timerDisplay = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  const setPreset = (n: number) => { setRunning(false); setTimerMinutes(n); setSeconds(n*60); };
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthMessage("");
    if (!isSupabaseConfigured) { setAuthMessage("First configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the server."); return; }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthMessage("Magic link sent. Check your inbox, then open the link on this device.");
    } catch (e) { setAuthMessage(e instanceof Error ? e.message : "Sign-in failed."); }
  };
  const signOut = async () => { if (isSupabaseConfigured) await createClient().auth.signOut(); setUserEmail(null); setSyncState("local"); notify("Signed out."); };
  const nav = [
    {id:"overview" as View,label:"Overview",Icon:LayoutDashboard},
    {id:"tasks" as View,label:"Tasks",Icon:ListTodo},
    {id:"subjects" as View,label:"Subjects",Icon:BookOpen},
    {id:"analytics" as View,label:"Analytics",Icon:TrendingUp},
  ];
  const titles: Record<View,string> = { overview:"Study overview", tasks:"Your tasks", subjects:"Your subjects", analytics:"Your analytics" };
  const toggleTask = (task: Task) => updateTask({ ...task, done: !task.done });
  const taskCard = (task: Task) => <div key={task.id} className="flex items-start gap-3 rounded-xl border border-[#343536] bg-[#272829] p-3"><input className="task-check" type="checkbox" checked={task.done} onChange={()=>toggleTask(task)} aria-label={`Complete ${task.title}`} /><div className={`min-w-0 flex-1 text-[11px] leading-relaxed ${task.done?"text-[#858681] line-through":"text-[#f4f0e8]"}`}>{task.title}<div className="mt-1 text-[9px] text-[#9c9b98]">{task.subject} · {task.priority} priority</div></div><span className="rounded-md border border-[#54432d] bg-[#393025] px-1.5 py-1 text-[9px] text-[#e9b66e]">{task.done?"Done":task.priority}</span></div>;
  const subjectRows = (full = false) => subjects.map((s,i)=><div key={s.id} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#3a3023] text-[10px]" style={{color:subjectColors[i%subjectColors.length]}}>{s.code.slice(0,3)}</div><div><div className="text-[11px] font-semibold">{s.name}</div>{full&&<div className="mt-1 text-[9px] text-[#9c9b98]">{s.progress}% complete</div>}<div className="progress-track mt-2"><div className="progress-fill" style={{width:`${s.progress}%`,background:subjectColors[i%subjectColors.length]}} /></div></div><div className="text-[10px] text-[#f4d39d]">{s.progress}%</div></div>);

  return <div className="min-h-screen bg-[#171819] text-[#f4f0e8]">
    <div className="mx-auto grid min-h-screen max-w-[1800px] grid-cols-1 md:grid-cols-[76px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col items-center gap-3 border-r border-[#37383a] bg-[#191a1b] px-2.5 py-5 md:flex">
        <div className="mb-5 grid h-[42px] w-[42px] place-items-center rounded-[14px] border border-[#6b5537] bg-[#28231c] text-2xl text-[#e9b66e]">◈</div>
        {nav.map(({id,label,Icon})=><button key={id} onClick={()=>setView(id)} className={`flex min-h-11 w-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] transition ${view===id?"bg-[#30291f] text-[#e9b66e]":"text-[#888986] hover:bg-[#252628] hover:text-[#e9b66e]"}`}><Icon size={18}/>{label}</button>)}
        <div className="flex-1"/><button onClick={()=>setShowAuth(true)} className="flex min-h-11 w-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] text-[#888986] hover:bg-[#252628]"><Settings2 size={18}/>Sync</button><div className="grid h-9 w-9 place-items-center rounded-full border border-[#8a6d43] bg-[#4b4030] text-xs font-bold text-[#f8d49a]">{userEmail?.slice(0,1).toUpperCase()||"S"}</div>
      </aside>
      <main className="min-w-0 px-3 pb-24 pt-5 sm:px-5 md:px-8 md:pb-8 md:pt-7">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div><div className="kicker">{userEmail ? "Your synced workspace" : "Your personal workspace"}</div><h1 className="mt-1 text-[25px] font-semibold tracking-[-.045em] sm:text-[29px]">{titles[view]}<span className="text-[#e9b66e]">.</span></h1><div className="mt-2 text-[11px] text-[#9c9b98]">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})} · A little progress every day adds up.</div></div>
          <div className="flex items-center gap-2"><div className="hidden rounded-xl border border-[#37383a] bg-[#202123] px-3 py-2.5 text-[10px] text-[#c9c5bd] sm:block"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${syncState==="synced"?"bg-[#a8be9b]":syncState==="error"?"bg-[#d98c7d]":"bg-[#e9b66e]"}`}/>{syncState==="synced"?"Cloud synced":syncState==="syncing"?"Syncing…":syncState==="error"?"Sync issue":"Local mode"}</div><button className="gold-button whitespace-nowrap" onClick={()=>setShowAuth(true)}>{userEmail?"Account":"⇧ Connect sync"}</button></div>
        </header>
        {view==="overview"&&<div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(220px,.95fr)_minmax(300px,1.35fr)_minmax(245px,1fr)] lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Daily completion</div><span className="text-[10px] text-[#9c9b98]">TODAY</span></div><div className="flex flex-col items-center py-2"><div className="grid h-[158px] w-[158px] place-items-center rounded-full" style={{background:`conic-gradient(#e9b66e ${completion*3.6}deg,#41403b 0)`}}><div className="grid h-[142px] w-[142px] place-items-center rounded-full border border-[#514535] bg-[#242321] text-center"><div><div className="text-[30px] font-semibold tracking-[-.06em]">{completion}%</div><div className="mt-1 text-[10px] text-[#9c9b98]">daily goals</div></div></div></div><div className="mt-4 flex w-full justify-between text-[10px] text-[#9c9b98]"><span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#e9b66e]"/>Tasks completed</span><strong className="text-[#f4d39d]">{completed} / {tasks.length}</strong></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[#343536] bg-[#28292a] p-3"><div className="text-[10px] text-[#9c9b98]">Focus today</div><div className="mt-1 text-xl">{focusToday}<span className="text-[10px] text-[#9c9b98]"> min</span></div></div><div className="rounded-xl border border-[#343536] bg-[#28292a] p-3"><div className="text-[10px] text-[#9c9b98]">Daily target</div><div className="mt-1 text-xl">{Math.min(100,Math.round(focusToday/target*100))}<span className="text-[10px] text-[#9c9b98]">%</span></div></div></div></section>
            <section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Today&apos;s priorities</div><button className="text-[10px] text-[#e9b66e]" onClick={()=>setView("tasks")}>View all ↗</button></div><div className="flex flex-col gap-2">{openTasks.slice(0,4).map(taskCard)}{openTasks.length===0&&<p className="text-xs text-[#9c9b98]">All clear. Enjoy the breathing room.</p>}</div><form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void addTask();}}><input className="field min-w-0" placeholder="Add a quick task…" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} aria-label="Quick task name"/><button className="ghost-button">Add</button></form></section>
            <section className="panel"><div className="mb-3 flex items-center justify-between"><div className="panel-title">A note to yourself</div><span className="text-[#e9b66e]">✧</span></div><p className="rounded-xl border border-[#4a3d2b] bg-[#28251f] p-3 text-[11px] leading-relaxed text-[#d7c8b0]"><strong className="text-[#f4d39d]">Focus on the next step.</strong><br/>Consistency beats intensity. Start with one focused session, then let momentum do the rest.</p></section>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3"><div className="panel"><div className="flex items-center justify-between text-[10px] text-[#9c9b98]">Study time <Clock3 size={14}/></div><div className="my-2 text-2xl font-semibold tracking-[-.06em]">{minsLabel(focusToday)}</div><div className="text-[10px] text-[#9c9b98]">Today&apos;s focused time</div></div><div className="panel"><div className="flex items-center justify-between text-[10px] text-[#9c9b98]">Tasks done <Check size={14}/></div><div className="my-2 text-2xl font-semibold tracking-[-.06em]">{completed}</div><div className="text-[10px] text-[#a8be9b]">{openTasks.length} remaining</div></div></div>
            <section className="panel text-center" id="focus-timer"><div className="mb-3 flex items-center justify-between"><div className="panel-title">Focus session</div><span className="rounded-md border border-[#54432d] bg-[#393025] px-2 py-1 text-[9px] text-[#e9b66e]">{timerMinutes} MIN SESSION</span></div><div className="mx-auto my-5 grid h-44 w-44 place-items-center rounded-full border-[5px] border-[#4a3b28] outline outline-1 outline-[#745b39]" style={{background:"radial-gradient(circle,#28241e 0%,#202020 68%)"}}><div><div className="text-[35px] font-semibold tracking-[-.06em] tabular-nums">{timerDisplay}</div><div className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#e9b66e]">{running?"Stay in the zone":seconds===0?"Session complete":"Ready to focus"}</div></div></div><div className="flex justify-center gap-2"><button className="gold-button min-w-28" onClick={()=>{if(seconds===0)setSeconds(timerMinutes*60);setRunning(!running);}}>{running?"Ⅱ Pause focus":"▶ Start focus"}</button><button className="ghost-button" onClick={()=>{setRunning(false);setSeconds(timerMinutes*60);}}><TimerReset size={13} className="inline"/> Reset</button></div><div className="mt-4 flex justify-center gap-2">{[75,50,25].map(n=><button key={n} onClick={()=>setPreset(n)} className={`rounded-lg border px-3 py-1.5 text-[9px] ${timerMinutes===n?"border-[#8b6a3d] bg-[#30271c] text-[#e9b66e]":"border-[#37383a] text-[#9c9b98]"}`}>{n} min</button>)}</div><div className="mt-4 text-[10px] text-[#9c9b98]">A clear mind starts with one thing at a time.</div></section>
            <section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Weekly focus</div><span className="text-[9px] text-[#9c9b98]">MINUTES / DAY</span></div><div className="flex h-[100px] items-end justify-around gap-2 border-b border-[#414143] px-1 pt-2">{week.map(d=><div key={d.label} title={`${d.minutes} minutes`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-6 rounded-t-md" style={{height:`${Math.max(3,d.minutes/maxWeek*82)}px`,background:d.current?"linear-gradient(#fff0c9,#d99b4f)":"linear-gradient(#f2cd91,#a8763d)"}}/><span className="text-[9px] text-[#898984]">{d.label}</span></div>)}</div></section>
          </div>
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1">
            <section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Subject progress</div><button className="text-[10px] text-[#e9b66e]" onClick={()=>setView("subjects")}>Manage ↗</button></div><div className="flex flex-col gap-4">{subjectRows()}</div></section>
            <section className="panel"><div className="mb-3 flex items-center justify-between"><div className="panel-title">Upcoming plan</div><span className="text-[9px] text-[#9c9b98]">NEXT UP</span></div><div className="flex flex-col">{openTasks.slice(0,3).map((t,i)=><div key={t.id} className="flex items-center gap-3 border-b border-[#37383a] py-3 last:border-0"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[#383026] text-[10px] text-[#e9b66e]">{String(i+1).padStart(2,"0")}</div><div className="min-w-0"><div className="text-[11px]">{t.title}</div><div className="mt-1 text-[9px] text-[#9c9b98]">{t.subject}</div></div></div>)}{openTasks.length===0&&<p className="text-xs text-[#9c9b98]">Nothing scheduled yet.</p>}</div><button className="ghost-button mt-3 w-full" onClick={()=>setView("tasks")}>Open study planner ↗</button></section>
            <section className="panel"><div className="mb-3 text-[12px] font-semibold">Study mantra <span className="float-right text-[#e9b66e]">✦</span></div><p className="text-[17px] leading-snug tracking-[-.03em]">“You don&apos;t have to be perfect. You just have to <span className="text-[#e9b66e]">show up.</span>”</p><div className="mt-2 text-[10px] text-[#9c9b98]">One session at a time.</div></section>
          </div>
        </div>}
        {view==="tasks"&&<div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">To do</div><span className="text-[10px] text-[#e9b66e]">{openTasks.length} OPEN</span></div><div className="flex flex-col gap-2">{openTasks.map(taskCard)}{!openTasks.length&&<p className="text-xs text-[#9c9b98]">Nothing pending. Nicely done.</p>}</div><form className="mt-4 flex flex-col gap-2" onSubmit={e=>{e.preventDefault();void addTask();}}><input className="field" placeholder="Task or topic" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} required/><div className="grid grid-cols-2 gap-2"><select className="field" value={taskSubject} onChange={e=>setTaskSubject(e.target.value)}>{subjects.map(s=><option key={s.id}>{s.name}</option>)}<option>General</option></select><select className="field" value={taskPriority} onChange={e=>setTaskPriority(e.target.value as Task["priority"])}><option>High</option><option>Medium</option><option>Low</option></select></div><button className="gold-button"><Plus size={14} className="mr-1 inline"/> Add task</button></form></section><section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Completed</div><span className="text-[10px] text-[#9c9b98]">DONE IS DONE</span></div><div className="flex flex-col gap-2">{tasks.filter(t=>t.done).map(taskCard)}{!completed&&<p className="text-xs text-[#9c9b98]">Completed tasks will appear here.</p>}</div></section></div>}
        {view==="subjects"&&<div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><section className="panel"><div className="mb-4 flex items-center justify-between"><div className="panel-title">Learning progress</div><span className="text-[9px] text-[#9c9b98]">THIS SEMESTER</span></div><div className="flex flex-col gap-5">{subjectRows(true)}</div><form className="mt-5 flex gap-2" onSubmit={e=>{e.preventDefault();void addSubject();}}><input className="field min-w-0" placeholder="New subject name" value={subjectName} onChange={e=>setSubjectName(e.target.value)} required/><button className="gold-button whitespace-nowrap"><Plus size={14} className="mr-1 inline"/> Add</button></form></section><section className="panel"><div className="mb-3 panel-title">Update a subject</div><p className="mb-4 rounded-xl border border-[#4a3d2b] bg-[#28251f] p-3 text-[11px] leading-relaxed text-[#d7c8b0]">Break every subject into small, measurable chapters. Update progress when you finish a topic, not just when you sit down to study.</p><label className="mb-2 block text-[11px] text-[#9c9b98]">Select subject</label><select className="field mb-5" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><label className="mb-2 block text-[11px] text-[#9c9b98]">Completion progress: <strong className="text-[#e9b66e]">{progressValue}%</strong></label><input className="mb-5 w-full accent-[#e9b66e]" type="range" min="0" max="100" step="5" value={progressValue} onChange={e=>setProgressValue(Number(e.target.value))}/><button className="gold-button w-full" onClick={()=>void saveProgress()}>Save progress</button></section></div>}
        {view==="analytics"&&<><div className="mb-3 grid grid-cols-2 gap-3"><section className="panel"><div className="text-[10px] text-[#9c9b98]">Total focus time</div><div className="my-2 text-2xl font-semibold">{minsLabel(totalFocus)}</div><div className="text-[10px] text-[#9c9b98]">Tracked study sessions</div></section><section className="panel"><div className="text-[10px] text-[#9c9b98]">Task completion</div><div className="my-2 text-2xl font-semibold">{completion}%</div><div className="text-[10px] text-[#9c9b98]">Across current tasks</div></section></div><div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><section className="panel"><div className="mb-4 panel-title">Focus minutes this week</div><div className="flex h-36 items-end justify-around gap-2 border-b border-[#414143]">{week.map(d=><div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-8 rounded-t-md" style={{height:`${Math.max(3,d.minutes/maxWeek*115)}px`,background:d.current?"#f4d39d":"#b78348"}}/><span className="text-[9px] text-[#898984]">{d.label}</span></div>)}</div></section><section className="panel"><div className="mb-4 panel-title">Subject breakdown</div><div className="flex flex-col gap-4">{subjectRows()}</div></section></div></>}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[9px] text-[#73736f]"><span>OBSIDIAN STUDY · Built for focus.</span><span>{userEmail?`Signed in as ${userEmail}`:"Local mode · Connect Supabase to sync devices"}</span></footer>
      </main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-[#37383a] bg-[#191a1b] px-2 pb-[max(7px,env(safe-area-inset-bottom))] pt-2 md:hidden">{nav.map(({id,label,Icon})=><button key={id} onClick={()=>setView(id)} className={`flex min-h-11 w-1/4 flex-col items-center justify-center gap-1 rounded-xl text-[9px] ${view===id?"text-[#e9b66e]":"text-[#888986]"}`}><Icon size={18}/>{label}</button>)}</nav>
    {toast&&<div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#e9b66e] px-4 py-3 text-xs font-bold text-[#21170c] shadow-xl md:bottom-5">{toast}</div>}
    {showAuth&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAuth(false);}}><div className="w-full max-w-md rounded-2xl border border-[#48433b] bg-[#222324] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Sync your study space</h2><button onClick={()=>setShowAuth(false)} aria-label="Close"><X size={18}/></button></div>{userEmail?<><p className="mb-4 text-xs leading-relaxed text-[#c5c1b9]">Signed in as <strong className="text-[#f4d39d]">{userEmail}</strong>. Your tasks, subjects and completed sessions can sync through Supabase.</p><button className="ghost-button w-full" onClick={()=>void signOut()}>Sign out</button></>:<><p className="mb-4 text-xs leading-relaxed text-[#c5c1b9]">Sign in with a magic link to keep your study tasks and subject progress in sync between your laptop and phone.</p><form onSubmit={signIn} className="flex flex-col gap-3"><label className="text-[11px] text-[#9c9b98]">Email address<input className="field mt-2" type="email" required placeholder="you@example.com" value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/></label><button className="gold-button w-full" type="submit">Send sign-in link</button></form>{!isSupabaseConfigured&&<p className="mt-3 rounded-xl border border-[#4a3d2b] bg-[#28251f] p-3 text-[10px] leading-relaxed text-[#d7c8b0]">Supabase isn&apos;t configured yet. Follow SETUP.md in the project ZIP to create a free project, add your environment keys and run the SQL schema.</p>}</>}{authMessage&&<p role="status" className="mt-3 text-[11px] leading-relaxed text-[#e9b66e]">{authMessage}</p>}<button className="ghost-button mt-4 w-full" onClick={()=>setShowAuth(false)}>Close</button></div></div>}
  </div>;
}
