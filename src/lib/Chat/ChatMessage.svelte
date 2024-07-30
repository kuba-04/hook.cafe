<script>
    export let text;
    export let timestamp;
    export let username;
  
    export let isSender = true;
  </script>
  
  <div class:relative="{true}" class:flex="{true}" class:pb-1="{true}" class:px-1="{true}" class:justify-end="{isSender}" class:justify-start="{!isSender}">
    <div class="relative w-5/6 px-2 break-all rounded-lg text-sm py-1 {isSender ? 'bg-gray-200' : 'bg-orange-200'}">
      {#if !isSender}
        <div class="font-bold text-gray-600">
          {username}
        </div>
      {/if}
      <span>{text}<span>
      <span style="font-size:10px" class="absolute mx-2 my-1 break-all text-gray-500 bottom-0 right-0">
        {new Date(timestamp).toLocaleTimeString()}
      <span>
    </div>
  </div>