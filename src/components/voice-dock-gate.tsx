import { auth } from "@/auth";
import { VoiceDock } from "@/components/voice-dock";

/** Shows the voice button only to signed-in people. */
export async function VoiceDockGate() {
  const session = await auth();
  return session?.user ? <VoiceDock /> : null;
}
