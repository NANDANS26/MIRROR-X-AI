export const generateMockResponse = (
  message: string
) => {
  const lower = message.toLowerCase();

  if (
    lower.includes("hello") ||
    lower.includes("hi")
  ) {
    return `Hello.

I'm ready to investigate digital experiences with you.

Upload a screenshot, paste a URL, or tell me what seems suspicious.`;
  }

  if (
    lower.includes("dark pattern")
  ) {
    return `Dark patterns are interface designs that influence users into actions they might not otherwise take.

My job is to identify those patterns and explain why they may be manipulative.`;
  }

  if (
    lower.includes("help")
  ) {
    return `I can:

• Investigate screenshots
• Analyze websites
• Explain manipulation techniques
• Highlight suspicious regions
• Generate forensic reports
• Suggest ethical redesigns`;
  }

  return `Interesting observation.

Let's investigate that further.

Can you provide a screenshot, URL, or additional context so I can analyze the experience more deeply?`;
};