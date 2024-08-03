<script>
  import isHotkey from "is-hotkey";
  import MessageView from "./ChatMessage.svelte";
  import { tick, createEventDispatcher, onMount } from "svelte";
  import { RELAY_URL } from "$lib/Env";
  import { NDKEvent } from "@nostr-dev-kit/ndk";
  import { v4 as uuid } from "uuid";

  const KIND_42_FILTER = { kinds: [42] };

  let message;
  let messages = [];
  let messageContainerRef;
//   let dispatch = createEventDispatcher();
  export let signerKey;
  export let username;
  export let channelId;
  export let ndk;
  let subscription;

  onMount(async () => {
    subscription = ndk.subscribe([KIND_42_FILTER], {
		closeOnEose: false,
    });
	
    subscription.on("event", async (event) => {
		const allowedChannelId = event.tagValue('e');
		if (allowedChannelId === channelId) {
			pushMessage(event.content, event.pubkey === signerKey);
		}
    });
    if (messages.length === 0) {
      ndk.fetchEvents([KIND_42_FILTER]).then((events) => {
        for (const event of events) {
			const allowedChannelId = event.tagValue('e');
			if (allowedChannelId === channelId) {
				pushMessage(event.content, event.pubkey === signerKey);
			}
        }
      });
    }
  });

  function handleKeydown(event) {
    if (isHotkey("enter", event)) {
      handleSend();
    }
  }

  class Message {
    constructor({ id, content, username, timestamp, isOwned }) {
      this.id = id;
      this.content = content;
      this.username = username;
      this.timestamp = timestamp;
      this.isOwned = isOwned;
    }
  }

  function pushMessage(content, isOwned) {
    const parsed = JSON.parse(content) || {};
    const message = new Message({
      id: parsed.id,
      content: parsed.content,
      username: parsed.username,
      timestamp: parsed.timestamp,
	  isOwned: isOwned
    });
    if (messages.some((m) => m.id === message.id)) {
      return;
    }
    messages = [...messages, message];
	scrollToEnd();
  }

  function scrollToEnd() {
    if (messageContainerRef) {
      messageContainerRef.scrollTop = messageContainerRef.scrollHeight;
    }
  }

  async function handleSend() {
    if (message) {
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 42;
      ndkEvent.content = JSON.stringify({
        id: uuid(),
        username: username,
        content: message,
        timestamp: new Date()
      });
      ndkEvent.tags = [["e", channelId, RELAY_URL, "root"]];
      await ndkEvent.publish().then((_) => {
        message = "";
        tick();
        scrollToEnd();
      });
    }
  }

</script>

<div
  class="message-box rounded-lg border border-radius mx-2 my-2 flex flex-col justify-between overflow-y-scroll no-scrollbar"
>
  <div class=" chat-header border-b px-4 py-1">
    <p class="text-gray-300">Hello! 👋</p>
  </div>
  <div
    bind:this={messageContainerRef}
    class="flex-grow overflow-auto w-full h-full py-1 overflow-y-scroll no-scrollbar"
  >
    <div
      style="min-height: 100%;"
      class="w-full chat-messages gap-y-2 overflow-auto flex flex-col justify-end mb-5"
    >
      {#each messages as message}
        <MessageView {...message}/>
      {/each}
    </div>
  </div>

  <div class="chat-input h-8 flex mb-2">
    <span class="flex-grow mx-1">
      <input
        placeholder="type..."
        on:keydown={handleKeydown}
        bind:value={message}
        class="border rounded-lg px-2 w-full h-full bg-gray-100"
      />
    </span>
<!-- text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 -->
    <button on:click={handleSend} type="button" class="text-white bg-gray-700 hover:bg-gray-800 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm p-2.5 text-center inline-flex items-center me-2 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-800">
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
        </svg>
      <span class="sr-only">Icon description</span>
    </button>

    <!-- <button
      on:click={handleSend}
      class="rounded-lg border flex px-3 items-center mx-1 justify-center "
    >
      <span class="text-gray-400 font-bold">
        <svg
          width="24px"
          height="24px"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
            id="SVGRepo_tracerCarrier"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></g><g id="SVGRepo_iconCarrier">
            <path
              d="M6 12H18M18 12L13 7M18 12L13 17"
              stroke="#ffffff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </g></svg
        >
      </span>
    </button> -->
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
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
  }
</style>
