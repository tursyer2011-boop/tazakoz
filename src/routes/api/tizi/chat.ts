import { createFileRoute } from "@tanstack/react-router";
import { handleTiziChat } from "@/lib/tizi.server";

export const Route = createFileRoute("/api/tizi/chat")({
  server: {
    handlers: {
      POST: ({ request }) => handleTiziChat(request),
    },
  },
});
