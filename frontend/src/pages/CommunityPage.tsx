import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CommunityMessage } from "../types";
import { socket } from "../lib/socket";

function appendUniqueMessage(existing: CommunityMessage[], incoming: CommunityMessage): CommunityMessage[] {
  if (existing.some((item) => item.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming];
}

export function CommunityPage() {
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [message, setMessage] = useState("");
  const [liveMessages, setLiveMessages] = useState<CommunityMessage[]>([]);
  const [sendError, setSendError] = useState("");

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["community-channels"],
    queryFn: () => api.community.channels()
  });

  useEffect(() => {
    if (!activeChannel && channels[0]) {
      setActiveChannel(channels[0].id);
    }
  }, [channels, activeChannel]);

  const messagesQuery = useQuery({
    queryKey: ["community-messages", activeChannel],
    queryFn: () => api.community.messages(activeChannel),
    enabled: Boolean(activeChannel)
  });

  useEffect(() => {
    if (messagesQuery.data) {
      setLiveMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!activeChannel) {
      return;
    }
    socket.connect();
    socket.emit("join-channel", activeChannel);
    const handler = (incoming: CommunityMessage) => {
      if (incoming.channelId === activeChannel) {
        setLiveMessages((prev) => appendUniqueMessage(prev, incoming));
      }
    };
    socket.on("community:new-message", handler);
    return () => {
      socket.off("community:new-message", handler);
    };
  }, [activeChannel]);

  const postMutation = useMutation({
    mutationFn: (body: string) => api.community.postMessage(activeChannel, body),
    onSuccess: (created) => {
      setLiveMessages((prev) => appendUniqueMessage(prev, created));
      setMessage("");
      setSendError("");
    },
    onError: (error) => {
      setSendError((error as Error).message);
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !activeChannel) {
      return;
    }
    postMutation.mutate(message.trim());
  }

  return (
    <div className="community-layout">
      <section className="panel channel-list">
        <h3>Channels</h3>
        {channelsLoading && <p className="subtitle">Loading channels...</p>}
        {channels.map((channel) => (
          <button
            key={channel.id}
            className={channel.id === activeChannel ? "channel-item active" : "channel-item"}
            onClick={() => setActiveChannel(channel.id)}
            type="button"
          >
            <strong>{channel.name}</strong>
            <span>{channel.memberCount} members</span>
          </button>
        ))}
      </section>

      <section className="panel chat-pane">
        <header className="chat-header">
          <h2>{channels.find((channel) => channel.id === activeChannel)?.name ?? "General Support"}</h2>
          <p>Safe, kind, and anonymous by default.</p>
        </header>
        <div className="chat-stream">
          {liveMessages.map((item) => (
            <article key={item.id} className="chat-msg">
              <strong>{item.senderName}</strong>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
        <form className="chat-composer" onSubmit={submit}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit" className="primary-btn" disabled={postMutation.isPending}>
            {postMutation.isPending ? "Sending..." : "Send"}
          </button>
        </form>
        {sendError && <p className="action-error">{sendError}</p>}
      </section>
    </div>
  );
}
