<script lang="ts">
  export let content: string;
  export let timestamp: string;
  export let username: string;
  export let isOwned: boolean;

  // Parse the content if it's a JSON string
  let messageContent: string;
  try {
    const parsed = JSON.parse(content);
    messageContent = parsed.content;
  } catch {
    messageContent = content;
  }
</script>

<div
  class:relative={true}
  class:flex={true}
  class:pb-1={true}
  class:px-1={true}
  class:justify-end={isOwned}
  class:justify-start={!isOwned}
>
  <div
    class="relative w-5/6 px-2 break-all rounded-lg text-sm py-1 {isOwned
      ? 'bg-yellow-100'
      : 'bg-green-200'}"
  >
    {#if !isOwned}
      <div class="font-bold text-gray-600">
        {username}
      </div>
    {/if}
    <span
      >{messageContent}<span>
        <span
          style="font-size:10px"
          class="absolute mx-2 my-1 break-all text-gray-500 bottom-0 right-0"
        >
          {new Date(timestamp).toLocaleTimeString([], { timeStyle: "short" })}
          <span> </span></span
        ></span
      ></span
    >
  </div>
</div>
