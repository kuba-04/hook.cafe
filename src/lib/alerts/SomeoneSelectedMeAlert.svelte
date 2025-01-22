<script>
  import { createEventDispatcher } from "svelte";

  export let eventData = null;

  const dispatch = createEventDispatcher();

  function dispatchChangeEvent() {
    dispatch("showAlert", false);
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
  <div class="text-xl w-12">👍</div>
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
  <div class="shrink-0 sm:flex sm:flex-col sm:items-end ml-auto">
    <div class="text-sm leading-6 text-gray-200 truncate"></div>
  </div>
  <button
    on:click={dispatchChangeEvent}
    type="button"
    class="ms-3 -mx-1.5 -my-1.5 bg-blue-50 text-blue-500 rounded-lg focus:ring-2 focus:ring-blue-400 p-1.5 hover:bg-blue-200 inline-flex items-center justify-center h-8 w-8 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
    aria-label="Close"
  >
    <span class="sr-only">Close</span>
    <svg
      class="w-3 h-3"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 14 14"
    >
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
      />
    </svg>
  </button>
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
