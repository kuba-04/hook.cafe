<script>
  import { createEventDispatcher } from "svelte";

  export let eventData;

  const dispatch = createEventDispatcher();

  function handleAccept() {
    const reactionData = {
      kind: 7,
      content: "+",
      tags: [
        ...eventData.tags.filter((tag) => tag[0] === "e" || tag[0] === "p"),
        ["e", eventData.id],
        ["p", eventData.pubkey],
        ["k", eventData.kind.toString()],
      ],
    };

    console.log("Dispatching reaction:", reactionData);
    dispatch("reaction", { reactionData });
  }

  function handleReject() {
    const reactionData = {
      kind: 7,
      content: "-",
      tags: [
        ...eventData.tags.filter((tag) => tag[0] === "e" || tag[0] === "p"),
        ["e", eventData.id],
        ["p", eventData.pubkey],
        ["k", eventData.kind.toString()],
      ],
    };

    console.log("Dispatching reaction:", reactionData);
    dispatch("reaction", { reactionData });
  }

  function parseEventContent(event) {
    const getTag = (name) => {
      const tag = event.tags.find((t) => t[0] === name);
      return tag ? tag[1] : "";
    };

    return {
      ...event,
      parsedContent: {
        word1: getTag("topic1"),
        word2: getTag("topic2"),
        word3: getTag("topic3"),
        word4: getTag("topic4"),
        timeFrom: getTag("timeFrom"),
        timeTo: getTag("timeTo"),
        location: getTag("location"),
        city: getTag("city"),
        minPrice: getTag("priceFrom"),
        maxPrice: getTag("priceTo"),
      },
    };
  }
</script>

<div
  class="flex items-center p-4 mb-4 text-sm rounded-lg bg-gray-800"
  role="alert"
>
  <div class="flex min-w-0 gap-x-7">
    <div class="flex min-w-10 items-center">
      {#if !eventData.author?.avatar}
        <div class="avatarLoader">Loading...</div>
      {:else}
        <img
          class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500"
          src={eventData.author.avatar}
          alt=""
        />
      {/if}
    </div>
    <div class="grid grid-cols-1 gap-0 content-center">
      <p class="text-sm truncate font-semibold text-white flex justify-start">
        {parseEventContent(eventData).parsedContent.word1}
        {parseEventContent(eventData).parsedContent.word2}
        {parseEventContent(eventData).parsedContent.word3}
        {parseEventContent(eventData).parsedContent.word4}
      </p>
      <p class="mt-1 truncate text-xs flex justify-start text-gray-500">
        {eventData.author?.name || "???"}
      </p>
    </div>
  </div>

  <div class="flex ml-auto gap-2">
    <button
      on:click={handleAccept}
      class="text-xl p-2 hover:bg-gray-700 rounded-full transition-colors duration-200"
      aria-label="Accept"
    >
      👍
    </button>
    <button
      on:click={handleReject}
      class="text-xl p-2 hover:bg-gray-700 rounded-full transition-colors duration-200"
      aria-label="Reject"
    >
      👎
    </button>
  </div>
</div>

<style>
  .avatarLoader {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #3498db;
    animation: spin 1s linear infinite;
    margin: auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
