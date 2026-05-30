import Sidebar from "../components/layout/Sidebar";

import Header from "../components/layout/Header";

import ChatContainer from "../components/chat/ChatContainer";

import ChatInput from "../components/chat/ChatInput";

export default function InvestigatorPage() {
  return (
    <div className="h-screen bg-black text-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <ChatContainer />

        <ChatInput />
      </div>
    </div>
  );
}