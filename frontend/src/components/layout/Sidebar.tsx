import { useChatStore } from "../../store/chatStore";

export default function Sidebar() {
  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
  } = useChatStore();

  return (
    <aside className="w-80 h-screen border-r border-slate-800 bg-slate-950 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <button
          onClick={createSession}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 font-medium"
        >
          + New Investigation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() =>
              setActiveSession(session.id)
            }
            className={`w-full text-left px-4 py-4 border-b border-slate-900 transition
            ${
              activeSessionId === session.id
                ? "bg-slate-800"
                : "hover:bg-slate-900"
            }`}
          >
            <div className="font-medium truncate">
              {session.title}
            </div>

            <div className="text-xs text-slate-400 mt-1">
              {new Date(
                session.createdAt
              ).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}