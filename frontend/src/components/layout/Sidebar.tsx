import {
  Plus,
  MessageSquare,
} from "lucide-react";

export default function Sidebar() {
  return (
    <div className="w-72 border-r border-white/10 bg-[#0A0A0A] flex flex-col">
      <div className="p-4">
        <button className="w-full bg-purple-600 rounded-xl py-3 flex items-center justify-center gap-2">
          <Plus size={18} />
          New Investigation
        </button>
      </div>

      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-400">
          <MessageSquare size={16} />
          Investigation History
        </div>

        <div className="text-sm bg-[#111827] p-3 rounded-xl">
          Sample Investigation
        </div>
      </div>
    </div>
  );
}