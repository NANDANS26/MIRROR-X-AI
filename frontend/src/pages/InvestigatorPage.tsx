import Sidebar from "../components/layout/Sidebar";

import Header from "../components/layout/Header";

import ChatContainer from "../components/chat/ChatContainer";

import ChatInput from "../components/chat/ChatInput";
import InvestigationOrb from "../widgets/InvestigationOrb";
import SystemStatus from "../os/SystemStatus";

export default function InvestigatorPage() {
  return (
    <div className="h-screen bg-black text-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />
        <div className="border-b border-white/10">
          <div className="max-w-5xl mx-auto py-10 flex items-center justify-between">
            <InvestigationOrb
              state="idle"
            />

            <SystemStatus
              status="READY"
              patterns={0}
            />
          </div>
        </div>

        <ChatContainer />

        <ChatInput />
      </div>
    </div>
  );
}