<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import NDK, { NDKEvent, type NDKSubscription } from "@nostr-dev-kit/ndk";
  import type { Message } from "../../types";

  export let ndk: NDK;
  export let username: string;
  export let channelId: string;
  export let signerKey: string;

  let messages: Message[] = [];
  let newMessage = "";
  let subscription: any; // TODO: Add proper NDKSubscription type
  let isLoading = true;
  let chatContainer: HTMLElement;

  interface ChatMessage {
    id: string;
    content: string;
    created_at: number;
    pubkey: string;
  }

  onMount(async () => {
    if (!channelId) return;

    const filter = {
      kinds: [42],
      "#e": [channelId],
      since: getBODTimestamp(),
    };

    subscription = ndk.subscribe([filter], { closeOnEose: false });
    subscription.on("event", handleNewMessage);

    const pastEvents = await ndk.fetchEvents(filter);
    pastEvents.forEach((event: NDKEvent) => {
      handleNewMessage(event);
    });

    isLoading = false;
  });

  function getBODTimestamp(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseInt((today.getTime() / 1000).toString());
  }

  function handleNewMessage(event: NDKEvent): void {
    const message: ChatMessage = {
      id: event.id,
      content: event.content,
      created_at: event.created_at || 0,
      pubkey: event.pubkey,
    };

    const messageExists = messages.some((m) => m.event.id === message.id);
    if (!messageExists) {
      messages = [...messages, { event } as Message].sort(
        (a, b) => (a.event.created_at || 0) - (b.event.created_at || 0),
      );
    }
  }

  function scrollToBottom(): void {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  $: if (messages) {
    setTimeout(scrollToBottom, 0);
  }

  async function sendMessage(): Promise<void> {
    if (!newMessage.trim()) return;

    try {
      const event = new NDKEvent(ndk);
      event.kind = 42;
      event.content = JSON.stringify({
        id: crypto.randomUUID(),
        username,
        content: newMessage,
        timestamp: new Date().toISOString(),
      });
      event.tags = [["e", channelId]];

      await event.publish();
      newMessage = "";
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  function handleKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function parseContent(content: string): string {
    try {
      return JSON.parse(content).content;
    } catch {
      return content;
    }
  }
</script>

<div
  id="message-box"
  class="message-box rounded-lg border border-gray-200 mx-2 my-2 flex flex-col justify-between overflow-y-scroll no-scrollbar"
>
  <div class=" chat-header border-b px-4 py-1">
    <p class="text-gray-300">Hello! 👋</p>
  </div>
  <div
    bind:this={chatContainer}
    class="flex-grow overflow-auto w-full h-full py-1 overflow-y-scroll no-scrollbar"
  >
    <div
      style="min-height: 100%;"
      class="w-full chat-messages gap-y-2 overflow-auto flex flex-col justify-end mb-5"
    >
      {#if isLoading}
        <div class="text-center text-gray-500">Loading messages...</div>
      {:else if messages.length === 0}
        <div class="text-center text-gray-500">No messages yet</div>
      {:else}
        {#each messages as message}
          <div
            class="flex items-start gap-2.5 {message.event.pubkey === signerKey
              ? 'justify-end'
              : ''}"
          >
            <div
              class="flex flex-col w-full max-w-[320px] leading-1.5 p-4 rounded-e-xl rounded-es-xl
              {message.event.pubkey === signerKey
                ? 'bg-yellow-100'
                : 'bg-green-100'}"
            >
              <div class="flex items-center space-x-2 rtl:space-x-reverse">
                <span class="text-md font-semibold text-gray-700">
                  {message.event.pubkey === signerKey ? "You" : username}
                </span>
                <span class="text-md font-normal text-gray-500">
                  {new Date(
                    (message.event.created_at ?? 0) * 1000,
                  ).toLocaleTimeString([], {
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p class="text-md font-normal py-2.5 text-gray-700">
                {parseContent(message.event.content)}
              </p>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="chat-input h-8 flex mt-2 mb-2">
    <span class="flex-grow mx-1">
      <textarea
        bind:value={newMessage}
        on:keypress={handleKeyPress}
        id="chat"
        rows="1"
        class="border rounded-lg px-2 w-full h-full bg-gray-100"
        placeholder="Your message..."
      />
    </span>
    <button
      on:click={sendMessage}
      type="button"
      class="text-white bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-md p-2.5 text-center inline-flex items-center me-2 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800"
    >
      <svg
        class="w-5 h-5"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 14 10"
      >
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M1 5h12m0 0L9 1m4 4L9 9"
        />
      </svg>
      <span class="sr-only">Icon description</span>
    </button>
  </div>
</div>

<style>
  .message-box {
    width: 350px;
    height: 300px;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
</style>
