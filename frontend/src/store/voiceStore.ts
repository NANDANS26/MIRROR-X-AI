/**
 * voiceStore.ts — Mic/voice mute state.
 *
 * isMuted = true  → AI does not speak, orb shows MicOff
 * isMuted = false → AI speaks assistant messages aloud
 *
 * toggleMute: flips isMuted. When muting, immediately cancels
 * any speech in progress via voiceService.stop().
 */

import { create } from 'zustand'
import { voiceService } from '../services/voiceService'

interface VoiceStore {
  isMuted: boolean
  toggleMute: () => void
  // Legacy: VoiceController reads `enabled` — keep it in sync
  enabled: boolean
  toggleVoice: () => void
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  isMuted: false,
  enabled: true,

  toggleMute: () => {
    const nowMuting = !get().isMuted
    if (nowMuting) {
      // Stop any speech that is currently playing
      voiceService.stop()
    }
    set({ isMuted: nowMuting, enabled: !nowMuting })
  },

  // Legacy alias — maps to the same toggle
  toggleVoice: () => {
    get().toggleMute()
  },
}))
