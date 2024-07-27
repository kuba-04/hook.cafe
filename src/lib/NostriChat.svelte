<!-- <script
  src="https://nostri.chat/public/bundle.js"
  data-chat-type="GLOBAL"
  data-chat-tags="bitcoin"
  data-relays="wss://relay.f7z.io,wss://nos.lol,wss://relay.nostr.band"
></script> -->
<script>

  const groupID = "<0e0d47a7f2dfb147d1509f9067a1bd0b3816139abb61f1ba77c932599029add8>";
  const relays = [RELAY_URL];

  import { onMount } from 'svelte';
  import { RELAY_URL } from "../lib/Env";

  onMount(() => {
    // Load the bundle.js script dynamically
    const script = document.createElement('script');
    script.src = "https://nostri.chat/public/bundle.js";
    script.dataset.chatType = "GROUP";
    script.dataset.chatId = groupID;
    script.dataset.relays = relays.join(',');

    script.onload = () => {
      // Script loaded successfully
    };

    script.onerror = () => {
      // Error handling if script fails to load
    };

    document.body.appendChild(script);

    // Load the bundle.css stylesheet
    const link = document.createElement('link');
    link.rel = "stylesheet";
    link.href = "https://nostri.chat/public/bundle.css";

    document.head.appendChild(link);
  });
</script>

<link rel="stylesheet" href="https://nostri.chat/public/bundle.css" />
