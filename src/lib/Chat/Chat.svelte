<script>
  import isHotkey from "is-hotkey";
  import MessageView from "./ChatMessage.svelte";
  import { tick, createEventDispatcher } from "svelte";

  export let chat = ``;
  export let username = `user-1`;
  export let data = {};

  let message;
  let messages = [];
  let messageContainerRef;
  let dispatch = createEventDispatcher();

  function handleKeydown(event) {
    if (isHotkey("enter", event)) {
      handleSend();
    }
  }

  class Message {
    constructor({ text, username, timestamp }) {
      this.text = text;
      this.username = username;
      this.timestamp = timestamp || Date.now();
    }
  }

  function pushMessage(str) {
    const message = new Message({ text: str, username });
    messages = [...messages, message];
    updateChat();
  }

  function parseMessages(str) {
    if (!str || str.length < 1) {
		return [];
	}
	try {
      const parsed = JSON.parse(str) || {};

      if (parsed && parsed.messages) {
        data = parsed.data || data;
        return parsed.messages.map((message) => new Message(message));
      } else {
        return [];
      }
    } catch (error) {
      console.error("Failed to parse messages:", error);
      return [];
    }
  }

  function updateChat() {
    chat = JSON.stringify({ messages, data });
  }

  function scrollToEnd() {
    if (messageContainerRef) {
      messageContainerRef.scrollTop = messageContainerRef.scrollHeight;
    }
  }

  async function handleSend() {
    if (message) {
      pushMessage(message);
      message = "";
      await tick();
      scrollToEnd();
    }
  }

  $: console.log(data, messages, chat);
  $: messages = parseMessages(chat);
</script>

<div
  class="message-box rounded-lg border border-radius mx-2 my-2 flex flex-col justify-between"
>
  <div class=" chat-header border-b px-4 py-1">
    <p class="text-gray-300">Nice to meet you! 👋 Any suggestions? 🥗</p>
  </div>
  <div
    bind:this={messageContainerRef}
    class="flex-grow overflow-auto w-full h-full py-1"
  >
    <div
      style="min-height: 100%;"
      class="w-full chat-messages overflow-auto flex flex-col justify-end"
    >
      {#each messages as message}
        <MessageView {...message} />
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

    <button
      on:click={handleSend}
      class="rounded-lg border flex px-3 items-center mx-1 justify-center"
    >
      <span class="text-gray-400 font-bold">
		<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6 12H18M18 12L13 7M18 12L13 17" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
	  </span>
    </button>
  </div>
</div>

<style>
  .message-box {
    width: 350px;
    height: 250px;
  }
</style>
