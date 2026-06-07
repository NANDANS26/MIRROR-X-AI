class VoiceService {
  private synth =
    window.speechSynthesis;

  speak(
    text: string
  ) {
    if (
      !("speechSynthesis" in window)
    )
      return;

    this.synth.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.rate = 1;

    utterance.pitch = 1;

    utterance.volume = 1;

    const voices =
      this.synth.getVoices();

    const preferred =
      voices.find(
        (voice) =>
          voice.name.includes(
            "Google"
          ) ||
          voice.name.includes(
            "Microsoft"
          )
      );

    if (preferred) {
      utterance.voice =
        preferred;
    }

    this.synth.speak(
      utterance
    );
  }

  stop() {
    this.synth.cancel();
  }
}

export const voiceService =
  new VoiceService();