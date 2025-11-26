'use client';

import { useState, useEffect, useRef } from 'react';
import StaffDashboard from '@/components/StaffDashboard';
import RealtimeProvider from '@/components/RealtimeProvider';
import { socket } from '@/lib/socket';
import { onCounts } from '@/lib/uiBus';

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<'live' | 'submissions'>('live');
  const [isConnected, setIsConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [lastSeenDraft, setLastSeenDraft] = useState(0);
  const [lastSeenSubmission, setLastSeenSubmission] = useState(0);
  const seenInitRef = useRef(false);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    // listen for counts from the dashboard
    const off = onCounts(({ drafts, submissions }) => {
      setDraftCount(drafts);
      setSubmissionCount(submissions);
      // On first emission, treat existing items as seen so badges don't show immediately
      if (!seenInitRef.current) {
        setLastSeenDraft(drafts);
        setLastSeenSubmission(submissions);
        seenInitRef.current = true;
      }
    });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initialize connection state
    setTimeout(() => {
      setIsConnected(socket.connected);
    }, 0);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      off();
    };
  }, []);

  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40">
          <div className="backdrop-blur-sm bg-white/70 border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16">
              {/* left: hamburger + logo */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">A</div>
                  <h1 className="text-lg font-semibold text-gray-800 hidden sm:block">Staff Dashboard</h1>
                </div>
              </div>

              {/* center: tabs (visible from sm+) */}
              <nav className="hidden sm:flex items-center bg-gray-100/70 p-1 rounded-full gap-1">
                <button
                  onClick={() => { setActiveTab('live'); setLastSeenDraft(draftCount); }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'live' ? 'bg-white text-primary shadow' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <span className="flex items-center gap-2">
                    Live Monitor
                    {Math.max(draftCount - lastSeenDraft, 0) > 0 && (
                      <span className="inline-flex items-center justify-center bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{Math.max(draftCount - lastSeenDraft, 0)}</span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => { setActiveTab('submissions'); setLastSeenSubmission(submissionCount); }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'submissions' ? 'bg-white text-primary shadow' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <span className="flex items-center gap-2">
                    Submissions
                    {Math.max(submissionCount - lastSeenSubmission, 0) > 0 && (
                      <span className="inline-flex items-center justify-center bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{Math.max(submissionCount - lastSeenSubmission, 0)}</span>
                    )}
                  </span>
                </button>
              </nav>

              {/* right: connection + profile */}
              <div className="flex items-center gap-3">
                <div className={`sm:hidden items-center gap-2 rounded-full text-xs font-medium border ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <span className={`relative flex h-2 w-2`}>
                    {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </span>
                </div>
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <span className={`relative flex h-2 w-2`}>
                    {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </span>
                  <span className="text-xs">{isConnected ? 'System Online' : 'Disconnected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">DS</div>
                </div>
                <button
                  className="sm:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                  aria-label="Open menu"
                  onClick={() => setMobileMenuOpen((s) => !s)}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* mobile menu panel: tabs + status */}
            {mobileMenuOpen && (
              <div className="sm:hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-t border-gray-100 bg-white/95">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setActiveTab('live'); setLastSeenDraft(draftCount); setMobileMenuOpen(false); }}
                      className={`flex-1 text-sm font-semibold px-4 py-2 rounded-full ${activeTab === 'live' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Live Monitor
                    </button>
                    <button
                      onClick={() => { setActiveTab('submissions'); setLastSeenSubmission(submissionCount); setMobileMenuOpen(false); }}
                      className={`flex-1 text-sm font-semibold px-4 py-2 rounded-full ${activeTab === 'submissions' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Submissions
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        </header>

        <StaffDashboard activeTab={activeTab} />
      </div>
    </RealtimeProvider>
  );
}
