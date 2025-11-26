'use client';

import { useState, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket';
import { emitCounts } from '@/lib/uiBus';

interface PatientData {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  language: string;
  nationality: string;
  religion: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  id?: string;
  sessionId?: string;
  submittedAt?: string;
  reviewed?: boolean;
}

export default function StaffDashboard({ activeTab }: { activeTab: 'live' | 'submissions' }) {
  const [drafts, setDrafts] = useState<Record<string, PatientData>>({});
  const [submissions, setSubmissions] = useState<PatientData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  
  // Typing status state
  const [typingStates, setTypingStates] = useState<Record<string, boolean>>({});
  const [lastActiveTimes, setLastActiveTimes] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(0);
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const timer = setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000); // Update every 30s
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Toasts state
  const [toasts, setToasts] = useState<{ id: number; message: string; type?: 'success' | 'info' | 'error' }[]>([]);
  const toastIdRef = useRef(0);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // Note: Close more menu at selection/change points to avoid effect-triggered setState

  function showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
    const id = ++toastIdRef.current;
    setToasts((s) => [{ id, message, type }, ...s]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
  }

  useEffect(() => {
    type SessionPayload = { sessionId: string; data: PatientData };

    socket.on('update-dashboard', (payload: SessionPayload | PatientData) => {
      if ('sessionId' in payload && (payload as SessionPayload).sessionId) {
        const p = payload as SessionPayload;
        setDrafts((prev) => ({ ...prev, [p.sessionId]: p.data }));

        // Handle typing status
        const sid = p.sessionId;
        setTypingStates((prev) => ({ ...prev, [sid]: true }));
        setLastActiveTimes((prev) => ({ ...prev, [sid]: Date.now() }));
        
        if (typingTimeouts.current[sid]) {
          clearTimeout(typingTimeouts.current[sid]);
        }
        
        typingTimeouts.current[sid] = setTimeout(() => {
          setTypingStates((prev) => ({ ...prev, [sid]: false }));
        }, 2000);
      }
    });

    socket.on('active-sessions', (list: Array<{ sessionId: string; draft: PatientData }>) => {
      if (!Array.isArray(list)) return;
      const map: Record<string, PatientData> = {};
      const times: Record<string, number> = {};
      list.forEach((it) => {
        if (it && it.sessionId && it.draft) {
          map[it.sessionId] = it.draft;
          times[it.sessionId] = Date.now();
        }
      });
      setDrafts(map);
      setLastActiveTimes((prev) => ({ ...prev, ...times }));
    });

    socket.on('initial-submissions', (list: PatientData[]) => {
      setSubmissions(list || []);
    });

    socket.on('new-submission', (data: PatientData) => {
      setSubmissions((prev) => [data, ...prev]);
      if (data.sessionId) {
        setDrafts((prev) => {
          const copy = { ...prev };
          delete copy[data.sessionId!];
          return copy;
        });
        if (selectedSessionId === data.sessionId) {
          setSelectedSessionId(null);
          setIsMoreMenuOpen(false);
          showToast('Patient submitted form successfully', 'success');
        }
      }
    });

    socket.on('review-updated', (payload: { id: string; reviewed: boolean }) => {
      setSubmissions((prev) => prev.map((s) => (s.id === payload.id ? { ...s, reviewed: payload.reviewed } : s)));
    });

    const timeouts = typingTimeouts.current;

    return () => {
      socket.off('update-dashboard');
      socket.off('new-submission');
      socket.off('initial-submissions');
      socket.off('review-updated');
      // Cleanup timeouts
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, [selectedSessionId]);

  function markReviewed(target: PatientData) {
    if (!target.id) return;
    setSubmissions((prev) => prev.map((s) => (s.id === target.id ? { ...s, reviewed: !s.reviewed } : s)));
    socket.emit('mark-reviewed', target.id);
    showToast(target.reviewed ? 'Marked as unreviewed' : 'Marked as reviewed', 'success');
  }

  function handleCopy(sub: PatientData) {
    navigator.clipboard?.writeText(JSON.stringify(sub, null, 2))
      .then(() => showToast('Copied submission to clipboard', 'success'))
      .catch(() => showToast('Failed to copy', 'error'));
  }

  function handlePrint() {
    window.print();
    showToast('Print dialog opened', 'info');
  }

  const selectedDraft = selectedSessionId ? drafts[selectedSessionId] : null;
  const selectedSubmission = submissions.find(s => s.id === selectedSubmissionId) || null;

  // Order sessions by last active time (most recent first)
  const orderedSessionEntries = Object.entries(drafts).sort((a, b) => {
    const ta = lastActiveTimes[a[0]] || 0;
    const tb = lastActiveTimes[b[0]] || 0;
    return tb - ta; // descending: newest first
  });

  // Ensure submissions are shown newest-first by submittedAt
  const sortedSubmissions = [...submissions].sort((a, b) => {
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return tb - ta; // descending: newest first
  });

  // Emit counts to UI bus so other components (like the page nav) can show badges
  useEffect(() => {
    try {
      emitCounts({ drafts: Object.keys(drafts).length, submissions: submissions.length });
    } catch { /* ignore */ }
  }, [drafts, submissions]);

  return (
    <>
      {/* Toast Container */}
      <div aria-live="polite" className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto min-w-[200px] max-w-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 border ${t.type === 'success' ? 'border-green-100 bg-white' : t.type === 'error' ? 'border-red-100 bg-white' : 'border-gray-100 bg-white'}`}>
            <div className={`w-2 h-2 rounded-full ${t.type === 'success' ? 'bg-green-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
            <div className="text-sm font-medium text-gray-700">{t.message}</div>
          </div>
        ))}
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 p-4 sm:p-6 min-h-[calc(100vh-64px)] md:h-[calc(100vh-70px)] overflow-hidden">
        {activeTab === 'live' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
            {/* Sidebar: Active Sessions List */}
            <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-svh">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Active Patients
                </h3>
                <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">{Object.keys(drafts).length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {Object.keys(drafts).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </div>
                    <p className="text-gray-400 text-sm">No active sessions</p>
                  </div>
                ) : (
                  orderedSessionEntries.map(([sessionId, draft]) => {
                    const isTyping = typingStates[sessionId];
                    const lastActive = lastActiveTimes[sessionId] || currentTime;
                    const secondsAgo = Math.max(0, Math.floor((currentTime - lastActive) / 1000));
                    const isIdle = secondsAgo > 60; // Idle if > 60s
                    
                    let statusText = 'Active';
                    if (secondsAgo < 60) statusText = 'Just now';
                    else if (secondsAgo < 3600) statusText = `${Math.floor(secondsAgo / 60)}m ago`;
                    else statusText = `${Math.floor(secondsAgo / 3600)}h ago`;

                    return (
                      <div 
                        key={sessionId} 
                        onClick={() => { setSelectedSessionId(sessionId); setIsMoreMenuOpen(false); }}
                        className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                          ${selectedSessionId === sessionId 
                            ? 'bg-white border-primary shadow-lg shadow-primary/10 ring-1 ring-primary' 
                            : 'bg-white border-gray-100 hover:border-primary/30 hover:shadow-md'
                          }`}
                      >
                        {/* Selection Indicator */}
                        {selectedSessionId === sessionId && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full" />
                        )}

                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105
                              ${selectedSessionId === sessionId 
                                ? 'bg-linear-to-br from-primary to-sky-600' 
                                : 'bg-gray-200 group-hover:bg-primary/70'
                              }`}
                            >
                              {draft.firstName?.[0] || '?'}{draft.lastName?.[0] || '?'}
                            </div>
                            {/* Online Badge */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                               <span className={`w-2.5 h-2.5 rounded-full ${isTyping ? 'bg-primary animate-pulse' : isIdle ? 'bg-gray-400' : 'bg-green-500'}`} />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className={`font-bold truncate text-sm ${selectedSessionId === sessionId ? 'text-gray-900' : 'text-gray-700'}`}>
                                {draft.firstName || 'Anonymous'} {draft.lastName}
                              </h4>
                              <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">
                                {sessionId.slice(0, 8)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                               <p className="text-xs text-gray-500 truncate max-w-[120px]">{draft.email || 'No email'}</p>
                               
                               {/* Status Indicator */}
                               {isTyping ? (
                                 <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                                   <span className="flex gap-0.5">
                                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                                   </span>
                                   <span className="text-[10px] font-bold text-primary  tracking-wider ml-1">Typing</span>
                                 </div>
                               ) : (
                                 <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${isIdle ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-100'}`}>
                                   <span className={`relative flex h-1.5 w-1.5 ${isIdle ? 'bg-gray-400' : 'bg-green-500'} rounded-full`}>
                                      {!isIdle && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isIdle ? 'bg-gray-400' : 'bg-green-500'}`}></span>
                                    </span>
                                   <span className={`text-[10px] font-medium  tracking-wider ${isIdle ? 'text-gray-500' : 'text-green-700'}`}>
                                     {isIdle ? `${statusText}` : 'Active'}
                                   </span>
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Main Content: Live Detail */}
            <div className={`md:col-span-8 bg-white md:rounded-2xl md:border border-gray-200 shadow-sm overflow-hidden flex flex-col 
              ${selectedDraft ? 'fixed inset-0 z-50 md:relative md:z-auto' : 'hidden md:flex'}
            `}>
              {selectedDraft ? (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                  {/* Detail Header */}
                  <div className="sticky top-0 z-30 p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white/80 backdrop-blur-md transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => { setSelectedSessionId(null); setIsMoreMenuOpen(false); }}
                        className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full shrink-0 transition-colors"
                        aria-label="Back to list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>

                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-linear-to-br from-primary to-accent flex items-center justify-center text-lg md:text-2xl shadow-lg shadow-primary/20 shrink-0 text-white font-bold">
                        {selectedDraft.gender === 'female' ? '👩' : '👨'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base md:text-xl font-bold text-gray-900 truncate leading-tight">{selectedDraft.firstName} {selectedDraft.lastName}</h2>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 truncate">
                          <span className="truncate">{selectedDraft.email || selectedDraft.phone || 'No contact info'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const isTyping = selectedSessionId ? typingStates[selectedSessionId] : false;
                        const lastActive = (selectedSessionId ? lastActiveTimes[selectedSessionId] : 0) || currentTime;
                        const secondsAgo = Math.max(0, Math.floor((currentTime - lastActive) / 1000));
                        const isIdle = secondsAgo > 60;
                        
                        return isTyping ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-xs">
                            <span className="flex gap-0.5">
                              <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                              <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-primary rounded-full animate-bounce"></span>
                            </span>
                            <span className="hidden sm:inline">TYPING</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-1.5 py-1 rounded-full text-[10px] md:text-xs font-bold border shadow-xs ${isIdle ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                            <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                              {!isIdle && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 ${isIdle ? 'bg-gray-400' : 'bg-green-500'}`}></span>
                            </span>
                            <span className="hidden sm:inline">{isIdle ? (secondsAgo < 60 ? 'IDLE' : `${Math.floor(secondsAgo / 60)}m ago`) : 'ACTIVE'}</span>
                          </span>
                        );
                      })()}

                      <div className="relative">
                        <button 
                          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                          className={`p-2 rounded-lg transition-colors ${isMoreMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                          aria-label="More options"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                        
                        {isMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                              <button onClick={() => { handleCopy(selectedDraft!); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Copy Data
                              </button>
                              <button onClick={() => { handlePrint(); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-20 md:pb-0">
                      {/* Session Info */}
                      <div className="md:col-span-2 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Session Details
                         </h4>
                         <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                            <FieldDisplay label="Session ID" value={selectedSessionId || ''} />
                            {/* <FieldDisplay label="Status" value={typingStates[selectedSessionId!] ? 'Typing...' : 'Active'} /> */}
                            <FieldDisplay label="Last Active" value={new Date(lastActiveTimes[selectedSessionId!] || currentTime).toLocaleTimeString()} />
                            {/* <FieldDisplay label="Draft Progress" value="In Progress" /> */}
                         </div>
                      </div>

                      {/* Personal Info Panel */}
                      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Personal Details
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <FieldDisplay label="Date of Birth" value={selectedDraft.dob} />
                            <FieldDisplay label="Gender" value={selectedDraft.gender} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FieldDisplay label="Nationality" value={selectedDraft.nationality} />
                            <FieldDisplay label="Religion" value={selectedDraft.religion} />
                          </div>
                          <FieldDisplay label="Language" value={selectedDraft.language} />
                        </div>
                      </div>

                      {/* Contact Info Panel */}
                      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Contact Information
                        </h4>
                        <div className="space-y-3">
                           <FieldDisplay label="Email" value={selectedDraft.email} />
                           <FieldDisplay label="Phone" value={selectedDraft.phone} />
                           <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Address</div>
                              <div className="text-sm text-gray-700 leading-relaxed">
                                {selectedDraft.address || <span className="text-gray-400 italic">No address provided</span>}
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* Emergency Contact Panel */}
                      <div className="md:col-span-2 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Emergency Contact
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <FieldDisplay label="Name" value={selectedDraft.emergencyContactName} />
                          <FieldDisplay label="Relation" value={selectedDraft.emergencyContactRelation} />
                          <FieldDisplay label="Phone" value={selectedDraft.emergencyContactPhone} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50/30">
                  <div className="w-24 h-24 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Select a Patient</h3>
                  <p className="text-gray-500 mt-2 max-w-xs">Choose an active session from the sidebar to view real-time data.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Submissions Tab
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
            {/* Sidebar: Submissions List */}
            <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-svh">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Submissions
                </h3>
                <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{submissions.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {submissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </div>
                    <p className="text-gray-400 text-sm">No submissions yet</p>
                  </div>
                ) : (
                  sortedSubmissions.map((sub) => (
                    <div 
                      key={sub.id} 
                      onClick={() => { setSelectedSubmissionId(sub.id || null); setIsMoreMenuOpen(false); }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 group ${selectedSubmissionId === sub.id ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-gray-100 hover:border-blue-100 hover:shadow-sm'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${sub.reviewed ? 'bg-green-500' : 'bg-blue-500'}`}>
                          {sub.firstName?.[0] || '?'}{sub.lastName?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className={`font-semibold truncate ${selectedSubmissionId === sub.id ? 'text-blue-800' : 'text-gray-700'}`}>
                              {sub.firstName} {sub.lastName}
                            </h4>
                            {sub.reviewed && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">REVIEWED</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{sub.email || 'No email'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-gray-400">{sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Just now'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Content: Submission Detail */}
            <div className={`md:col-span-8 bg-white md:rounded-2xl md:border border-gray-200 shadow-sm overflow-hidden flex flex-col 
              ${selectedSubmission ? 'fixed inset-0 z-50 md:relative md:z-auto' : 'hidden md:flex'}
            `}>
              {selectedSubmission ? (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                  {/* Detail Header */}
                  <div className="sticky top-0 z-30 p-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white/80 backdrop-blur-md transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => { setSelectedSubmissionId(null); setIsMoreMenuOpen(false); }}
                        className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full shrink-0 transition-colors"
                        aria-label="Back to list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>

                      <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-2xl shadow-lg shrink-0 text-white font-bold ${selectedSubmission.reviewed ? 'bg-green-500 shadow-green-200' : 'bg-blue-500 shadow-blue-200'}`}>
                        {selectedSubmission.gender === 'female' ? '👩' : '👨'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base md:text-xl font-bold text-gray-900 truncate leading-tight">{selectedSubmission.firstName} {selectedSubmission.lastName}</h2>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 truncate">
                           <span className="truncate">{new Date(selectedSubmission.submittedAt!).toLocaleDateString()}</span>
                           {selectedSubmission.reviewed && <span className="px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold">REVIEWED</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Mark Reviewed Button - Icon on mobile, Text on desktop */}
                      <button 
                        onClick={() => markReviewed(selectedSubmission!)} 
                        className={`p-2 md:px-4 md:py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${selectedSubmission.reviewed ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'}`}
                        title={selectedSubmission.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="hidden md:inline">{selectedSubmission.reviewed ? 'Unreview' : 'Review'}</span>
                      </button>

                      <div className="relative">
                        <button 
                          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                          className={`p-2 rounded-lg transition-colors ${isMoreMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                          aria-label="More options"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                        
                        {isMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                              <button onClick={() => { handleCopy(selectedSubmission!); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Copy Data
                              </button>
                              <button onClick={() => { handlePrint(); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-20 md:pb-0">
                      {/* Submission Info */}
                      <div className="md:col-span-2 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            Submission Details
                         </h4>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <FieldDisplay label="Submission ID" value={selectedSubmission.id?.slice(0,8) || ''} />
                            <FieldDisplay label="Status" value={selectedSubmission.reviewed ? 'Reviewed' : 'Pending Review'} />
                            <FieldDisplay label="Submitted At" value={selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleDateString() : '-'} />
                            <FieldDisplay label="Time" value={selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleTimeString() : '-'} />
                         </div>
                      </div>

                      {/* Personal Info Panel */}
                      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Personal Details
                        </h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <FieldDisplay label="Date of Birth" value={selectedSubmission.dob} />
                            <FieldDisplay label="Gender" value={selectedSubmission.gender} />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <FieldDisplay label="Nationality" value={selectedSubmission.nationality} />
                            <FieldDisplay label="Religion" value={selectedSubmission.religion} />
                          </div>

                          <FieldDisplay label="Language" value={selectedSubmission.language} />
                        </div>
                      </div>

                      {/* Contact Info Panel */}
                      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Contact Information
                        </h4>
                        <div className="space-y-3">
                           <FieldDisplay label="Email" value={selectedSubmission.email} />
                           <FieldDisplay label="Phone" value={selectedSubmission.phone} />
                           <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Address</div>
                              <div className="text-sm text-gray-700 leading-relaxed">
                                {selectedSubmission.address || <span className="text-gray-400 italic">No address provided</span>}
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* Emergency Contact Panel */}
                      <div className="md:col-span-2 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Emergency Contact
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <FieldDisplay label="Name" value={selectedSubmission.emergencyContactName} />
                          <FieldDisplay label="Relation" value={selectedSubmission.emergencyContactRelation} />
                          <FieldDisplay label="Phone" value={selectedSubmission.emergencyContactPhone} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50/30">
                  <div className="w-24 h-24 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Select a Submission</h3>
                  <p className="text-gray-500 mt-2 max-w-xs">Choose a submission from the list to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function FieldDisplay({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="p-3 bg-white/60 rounded-xl border border-gray-100">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`font-medium truncate ${value ? 'text-gray-900' : 'text-gray-300 italic'}`}>
        {value || '-'}
      </div>
    </div>
  );
}

// DetailRow removed — modal now uses inline rows and chips for a more modern layout.

