<script lang="ts">
  import Modal from "../../../lib/Modal.svelte";
  import NDK, {
    NDKEvent,
    NDKPrivateKeySigner,
    type NDKUser,
    type NDKUserProfile,
  } from "@nostr-dev-kit/ndk";
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";
  import { goto } from "$app/navigation";
  import { getAllAvatars } from "$lib/avatars";
  import PasswordDisplay from "$lib/PasswordDisplay.svelte";
  import citiesData from "../../../lib/cities_tz.json";
  import { page } from "$app/stores";
  import { nip19 } from "nostr-tools";

  interface City {
    cityName: string;
    cityCountry: string;
    tz: string;
  }

  let selectedAvatar: string | undefined | number = "";
  let ndk: NDK;
  let name = "";
  let npub: string;
  let hexPubkey: string;
  let privKey: string = "";
  let keyArray: Uint8Array;
  let avatar: string | undefined | number = "";
  let showModal = false;
  let showAlertOnSave = false;
  let hasAlreadySubmitted = false;
  let showAlertOnAlreadySubmitted = false;
  let showAlertOnCopyNpub = false;

  let query = "";
  let results: Array<{
    name: string;
    country: string;
    population: number;
    tz: string;
  }> = [];
  let city: City | null = null;
  let avatars: string[] = [];

  // Relay management
  let relays: Array<{ url: string; read: boolean; write: boolean }> = [];
  let newRelayUrl = "";
  let showAddRelayError = false;
  let addRelayErrorMessage = "";

  onMount(async () => {
    avatars = getAllAvatars();
    npub = $page.params.id;
    if (!npub) {
      console.log("not found");
      goto("/");
    }
    privKey = $page.state?.privKey;
    if (!privKey) {
      console.log("session ends..");
      goto("/");
    }

    // Load relays from localStorage first for faster display
    const savedRelays = localStorage.getItem("userRelays");
    if (savedRelays) {
      try {
        relays = JSON.parse(savedRelays);
      } catch (e) {
        console.error("Failed to parse saved relays:", e);
      }
    }

    // Add default relay from env if no relays exist
    if (relays.length === 0) {
      relays = env.PUBLIC_RELAY_URL.split(",").map((url) => ({
        url: url.trim(),
        read: true,
        write: true,
      }));
    }

    if (typeof privKey === "string") {
      keyArray = new Uint8Array(
        privKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
      );
    }

    const signer = new NDKPrivateKeySigner(keyArray);
    ndk = new NDK({
      explicitRelayUrls: env.PUBLIC_RELAY_URL.split(",").map((url) =>
        url.trim(),
      ),
      signer,
    });
    await ndk.connect();

    const profile = await getUserProfile(ndk, npub);
    name = profile.name || "";
    if (profile.bio) {
      const [cityName, cityCountry, tz] = profile.bio.split(",");
      city =
        cityName && cityCountry && tz ? { cityName, cityCountry, tz } : null;
    }
    query = city ? `${city.cityName}, ${city.cityCountry}, ${city.tz}` : "";
    avatar = profile.image || "";

    // Fetch relay list from the network
    await fetchRelayList();

    ndk
      .fetchEvents({
        kinds: [1],
        authors: [hexPubkey],
        since: getBODTimestamp(),
        until: getEODTimestamp(),
      })
      .then((events) => {
        if (events.size > 0) {
          hasAlreadySubmitted = true;
        }
      });
  });

  function getBODTimestamp(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseInt(today.getTime().toString().substring(0, 10));
  }

  function getEODTimestamp(): number {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return parseInt(today.getTime().toString().substring(0, 10));
  }

  async function getUserProfile(
    ndk: NDK,
    npub: string,
  ): Promise<NDKUserProfile> {
    const user = ndk.getUser({
      npub,
    });
    hexPubkey = user.pubkey;
    await user.fetchProfile();
    return user.profile || ({} as NDKUserProfile);
  }

  function selectAvatar(av: string): void {
    selectedAvatar = av;
    showModal = false;
    avatar = av;
  }

  async function save(): Promise<void> {
    if (city === null || name.length === 0) {
      showAlertOnSave = true;
      setTimeout(() => (showAlertOnSave = false), 1500);
      return;
    }
    if (!selectedAvatar) {
      selectedAvatar = avatar;
    }

    try {
      const avatar = `${selectedAvatar}`;
      await setProfileData(ndk, name, city, avatar);
      goto("/", { state: { privKey } });
      return;
    } catch (error) {
      console.error("Error saving profile data:", error);
      alert("Failed to save profile data. Please try again.");
    }
  }

  async function setProfileData(
    ndk: NDK,
    name: string,
    city: City | null,
    avatar: string,
  ): Promise<void> {
    const metadataEvent = new NDKEvent(ndk);
    metadataEvent.kind = 0;
    const content = JSON.stringify({
      name: name,
      bio: city ? `${city.cityName},${city.cityCountry},${city.tz}` : "",
      image: avatar,
    });
    metadataEvent.content = content;
    await metadataEvent.publish();
  }

  function showAvatars(): void {
    showModal = true;
  }

  function logout(): void {
    localStorage.clear();
    goto("/");
  }

  function goBack(): void {
    goto("/", { state: { privKey } });
  }

  function searchCities(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    results = citiesData
      .filter((city) => city.name.toLowerCase().startsWith(normalizedQuery))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
  }

  function handleInputCity(event: Event): void {
    const target = event.target as HTMLInputElement;
    query = target.value;
    city = null;
    searchCities(query);
  }

  async function selectCity(c: {
    name: string;
    country: string;
    tz: string;
  }): Promise<void> {
    city = { cityName: c.name, cityCountry: c.country, tz: c.tz };
    query = `${c.name}, ${c.country}`;
    results = [];
  }

  function copyNpub(): void {
    navigator.clipboard
      .writeText(npub)
      .then(() => {
        showAlertOnCopyNpub = true;
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      })
      .finally(() => setTimeout(() => (showAlertOnCopyNpub = false), 1500));
  }

  function nsec(hexKey: string | Uint8Array): string {
    if (typeof hexKey === "string") {
      const bytes = new Uint8Array(
        hexKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
      );
      return nip19.nsecEncode(bytes);
    } else {
      return nip19.nsecEncode(hexKey);
    }
  }

  async function fetchRelayList(): Promise<void> {
    try {
      // Fetch kind:10002 events for the user
      const relayListEvents = await ndk.fetchEvents({
        kinds: [10002],
        authors: [hexPubkey],
      });

      // Get the most recent event
      const relayListEvent = Array.from(relayListEvents).sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0),
      )[0];

      if (relayListEvent) {
        // Parse relay list from the event
        const newRelays: Array<{ url: string; read: boolean; write: boolean }> =
          [];

        relayListEvent.tags
          .filter((tag) => tag[0] === "r")
          .forEach((tag) => {
            const url = tag[1];
            const permission = tag[2] || "read-write";

            newRelays.push({
              url,
              read:
                permission === "read" ||
                permission === "read-write" ||
                !permission,
              write:
                permission === "write" ||
                permission === "read-write" ||
                !permission,
            });
          });

        if (newRelays.length > 0) {
          relays = newRelays;
          // Save to localStorage
          localStorage.setItem("userRelays", JSON.stringify(relays));
        }
      }
    } catch (error) {
      console.error("Error fetching relay list:", error);
    }
  }

  async function publishRelayList(): Promise<void> {
    try {
      const relayListEvent = new NDKEvent(ndk);
      relayListEvent.kind = 10002;
      relayListEvent.content = "";

      // Add relay tags
      relays.forEach((relay) => {
        if (relay.read && relay.write) {
          relayListEvent.tags.push(["r", relay.url]);
        } else if (relay.read) {
          relayListEvent.tags.push(["r", relay.url, "read"]);
        } else if (relay.write) {
          relayListEvent.tags.push(["r", relay.url, "write"]);
        }
      });

      await relayListEvent.publish();

      // Save to localStorage
      localStorage.setItem("userRelays", JSON.stringify(relays));
    } catch (error) {
      console.error("Error publishing relay list:", error);
    }
  }

  function addRelay(): void {
    // Validate URL
    try {
      const url = new URL(newRelayUrl);
      if (url.protocol !== "wss:" && url.protocol !== "ws:") {
        showAddRelayError = true;
        addRelayErrorMessage = "Relay URL must use ws:// or wss:// protocol";
        return;
      }

      // Check if relay already exists
      if (relays.some((relay) => relay.url === newRelayUrl)) {
        showAddRelayError = true;
        addRelayErrorMessage = "This relay is already in your list";
        return;
      }

      // Add relay
      relays = [
        ...relays,
        {
          url: newRelayUrl,
          read: true,
          write: true,
        },
      ];

      // Clear input and error
      newRelayUrl = "";
      showAddRelayError = false;

      // Save changes
      publishRelayList();
    } catch (error) {
      showAddRelayError = true;
      addRelayErrorMessage = "Invalid URL format";
    }
  }

  function removeRelay(url: string): void {
    // Don't allow removing the last relay
    if (relays.length <= 1) {
      return;
    }

    relays = relays.filter((relay) => relay.url !== url);
    publishRelayList();
  }

  function toggleRelayPermission(
    url: string,
    permission: "read" | "write",
  ): void {
    relays = relays.map((relay) => {
      if (relay.url === url) {
        if (permission === "read") {
          return { ...relay, read: !relay.read };
        } else {
          return { ...relay, write: !relay.write };
        }
      }
      return relay;
    });

    publishRelayList();
  }
</script>

<main>
  {#if showModal}
    <Modal bind:showModal>
      <br />
      <br />
      <div class="grid gap-4">
        {#each avatars as av}
          <button on:click={() => selectAvatar(av)}>
            <img
              class="w-20 h-20 rounded-full"
              class:selected={selectedAvatar === av}
              src={av}
              alt="avatar"
            />
          </button>
        {/each}
      </div></Modal
    >
  {/if}
  <header class="bg-gray-900">
    <nav class="flex p-6 justify-center" aria-label="Global">
      <div>
        <button
          on:click={goBack}
          type="button"
          class="text-gray-300 bg-gray-100 hover:bg-blue-300 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-full text-sm p-2.5 text-center inline-flex items-center me-2 dark:bg-gray-300 dark:hover:bg-blue-300 dark:focus:ring-gray-800"
        >
          <svg
            fill="#000000"
            height="20px"
            width="20px"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 26.676 26.676"
            xml:space="preserve"
            ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
              id="SVGRepo_tracerCarrier"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></g><g id="SVGRepo_iconCarrier">
              <g>
                <path
                  d="M26.105,21.891c-0.229,0-0.439-0.131-0.529-0.346l0,0c-0.066-0.156-1.716-3.857-7.885-4.59 c-1.285-0.156-2.824-0.236-4.693-0.25v4.613c0,0.213-0.115,0.406-0.304,0.508c-0.188,0.098-0.413,0.084-0.588-0.033L0.254,13.815 C0.094,13.708,0,13.528,0,13.339c0-0.191,0.094-0.365,0.254-0.477l11.857-7.979c0.175-0.121,0.398-0.129,0.588-0.029 c0.19,0.102,0.303,0.295,0.303,0.502v4.293c2.578,0.336,13.674,2.33,13.674,11.674c0,0.271-0.191,0.508-0.459,0.562 C26.18,21.891,26.141,21.891,26.105,21.891z"
                ></path> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g>
                <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g>
                <g> </g> <g> </g>
              </g>
            </g></svg
          >
        </button>
        <button
          on:click={save}
          type="button"
          class="text-gray-300 bg-gray-100 hover:bg-green-300 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-full text-sm p-2.5 text-center inline-flex items-center me-2 dark:bg-gray-300 dark:hover:bg-green-200 dark:focus:ring-gray-800"
        >
          <svg
            height="20px"
            width="20px"
            viewBox="0 0 26.676 26.676"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
              id="SVGRepo_tracerCarrier"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></g><g id="SVGRepo_iconCarrier">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z"
                fill="#0F0F0F"
              ></path>
            </g></svg
          >
        </button>
        <button
          on:click={logout}
          type="button"
          class="text-gray-300 bg-gray-100 hover:bg-red-300 focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-full text-sm p-2.5 text-center inline-flex items-center me-2 dark:bg-gray-300 dark:hover:bg-red-300 dark:focus:ring-gray-800"
        >
          <svg
            height="20px"
            width="20px"
            viewBox="0 0 26.676 26.676"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
              id="SVGRepo_tracerCarrier"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></g><g id="SVGRepo_iconCarrier">
              <path
                d="M11.75 9.874C11.75 10.2882 12.0858 10.624 12.5 10.624C12.9142 10.624 13.25 10.2882 13.25 9.874H11.75ZM13.25 4C13.25 3.58579 12.9142 3.25 12.5 3.25C12.0858 3.25 11.75 3.58579 11.75 4H13.25ZM9.81082 6.66156C10.1878 6.48991 10.3542 6.04515 10.1826 5.66818C10.0109 5.29121 9.56615 5.12478 9.18918 5.29644L9.81082 6.66156ZM5.5 12.16L4.7499 12.1561L4.75005 12.1687L5.5 12.16ZM12.5 19L12.5086 18.25C12.5029 18.25 12.4971 18.25 12.4914 18.25L12.5 19ZM19.5 12.16L20.2501 12.1687L20.25 12.1561L19.5 12.16ZM15.8108 5.29644C15.4338 5.12478 14.9891 5.29121 14.8174 5.66818C14.6458 6.04515 14.8122 6.48991 15.1892 6.66156L15.8108 5.29644ZM13.25 9.874V4H11.75V9.874H13.25ZM9.18918 5.29644C6.49843 6.52171 4.7655 9.19951 4.75001 12.1561L6.24999 12.1639C6.26242 9.79237 7.65246 7.6444 9.81082 6.66156L9.18918 5.29644ZM4.75005 12.1687C4.79935 16.4046 8.27278 19.7986 12.5086 19.75L12.4914 18.25C9.08384 18.2892 6.28961 15.5588 6.24995 12.1513L4.75005 12.1687ZM12.4914 19.75C16.7272 19.7986 20.2007 16.4046 20.2499 12.1687L18.7501 12.1513C18.7104 15.5588 15.9162 18.2892 12.5086 18.25L12.4914 19.75ZM20.25 12.1561C20.2345 9.19951 18.5016 6.52171 15.8108 5.29644L15.1892 6.66156C17.3475 7.6444 18.7376 9.79237 18.75 12.1639L20.25 12.1561Z"
                fill="#000000"
              ></path>
            </g></svg
          >
        </button>
      </div>
      {#if showAlertOnSave}
        <div
          class="fixed inset-0 flex items-center justify-center z-50"
          on:click={() => (showAlertOnSave = false)}
        >
          <div class="absolute inset-0 bg-black bg-opacity-30"></div>
          <div
            class="relative bg-gray-700 p-4 rounded-lg shadow-lg max-w-md"
            on:click|stopPropagation
          >
            <button
              class="absolute top-2 right-2 text-gray-400 hover:text-white"
              on:click={() => (showAlertOnSave = false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div class="flex items-center">
              <svg
                class="flex-shrink-0 w-6 h-6 me-3 text-yellow-300"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
                />
              </svg>
              <span class="text-lg font-semibold leading-6 text-white">
                Some fields are not filled!
              </span>
            </div>
          </div>
        </div>
      {/if}
      {#if showAlertOnAlreadySubmitted}
        <div
          class="fixed inset-0 flex items-center justify-center z-50"
          on:click={() => (showAlertOnAlreadySubmitted = false)}
        >
          <div class="absolute inset-0 bg-black bg-opacity-30"></div>
          <div
            class="relative bg-gray-700 p-4 rounded-lg shadow-lg max-w-md"
            on:click|stopPropagation
          >
            <button
              class="absolute top-2 right-2 text-gray-400 hover:text-white"
              on:click={() => (showAlertOnAlreadySubmitted = false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div class="flex items-center">
              <svg
                class="flex-shrink-0 w-6 h-6 me-3 text-yellow-300"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
                />
              </svg>
              <span class="text-lg font-semibold leading-6 text-white">
                You can't change the city if already sent request for it. Wait
                until it expires.
              </span>
            </div>
          </div>
        </div>
      {/if}
    </nav>
  </header>

  <div
    class="relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32"
  >
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="px-4 sm:px-0">
        <h3 class="text-base font-semibold leading-7 text-gray-300">Profile</h3>
      </div>
      <div class="mt-6 border-t border-gray-100">
        <dl class="divide-y divide-gray-100">
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">
              Name/nickname
            </dt>
            <!-- <dd
              class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 "
            >
              {name}
            </dd> -->
            <div class="w-full relative">
              <input
                bind:value={name}
                id="name"
                name="text"
                type="text"
                required
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-1 sm:mt-0 bg-gray-900 dark:hover:bg-gray-600 w-full px-3 py-2 rounded-md pr-8"
                placeholder="Name"
              />
              {#if name}
                <button
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  on:click={() => {
                    name = "";
                  }}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              {/if}
            </div>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">City</dt>
            <div class="relative w-full">
              <input
                id="city"
                name="text"
                type="text"
                required
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-1 sm:mt-0 bg-gray-900 dark:hover:bg-gray-600 w-full px-3 py-2 rounded-md pr-8"
                placeholder="City"
                bind:value={query}
                on:input={handleInputCity}
                disabled={hasAlreadySubmitted}
              />
              {#if query && !hasAlreadySubmitted}
                <button
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  on:click={() => {
                    query = "";
                    city = null;
                    results = [];
                  }}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              {/if}
              {#if results.length > 0}
                <div
                  class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                >
                  {#each results as city}
                    <button
                      class="cursor-pointer select-none relative py-2 pl-3 pr-9 text-gray-900 hover:bg-teal-600 hover:text-white w-full text-left truncate"
                      on:click={() => selectCity(city)}
                    >
                      {city.name}, {city.country}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div
            class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 npub-container"
          >
            <dt class="text-sm font-medium leading-6 text-gray-300">
              Your public key
            </dt>
            <dd>
              <p
                class="mt-1 text-xs leading-6 text-gray-400 sm:col-span-2 sm:mt-0"
              >
                Your ID (like username) other people can find you by this.
              </p>
              <p
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 break-words"
              >
                {npub}
              </p>
            </dd>
            <div class="left-10 flex items-center">
              <button
                on:click={copyNpub}
                class="copy-button text-sm text-gray-300"
              >
                copy
              </button>

              {#if showAlertOnCopyNpub}
                <div
                  class="fixed inset-0 flex items-center justify-center z-50"
                  on:click={() => (showAlertOnCopyNpub = false)}
                >
                  <div class="absolute inset-0 bg-black bg-opacity-30"></div>
                  <div
                    class="relative bg-gray-700 p-4 rounded-lg shadow-lg max-w-md"
                    on:click|stopPropagation
                  >
                    <button
                      class="absolute top-2 right-2 text-gray-400 hover:text-white"
                      on:click={() => (showAlertOnCopyNpub = false)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                    <div class="flex items-center">
                      <svg
                        class="flex-shrink-0 w-6 h-6 me-3 text-blue-400"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        />
                      </svg>
                      <span class="text-lg font-semibold leading-6 text-white">
                        NPUB copied to clipboard!
                      </span>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">
              Your private key
            </dt>
            <dd>
              <p
                class="mt-1 text-xs leading-6 text-gray-400 sm:col-span-2 sm:mt-0"
              >
                Your password (but cannot be changed!) we recommend saving it in
                a password manager or keeping secure (you can't log in again
                without your key!)
              </p>
              <p
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 break-words"
              >
                {#if privKey}
                  <PasswordDisplay password={nsec(privKey)} />
                {/if}
              </p>
            </dd>
          </div>
          <!-- Relay Management Section -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">Relays</dt>
            <dd
              class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0"
            >
              <p class="text-xs leading-6 text-gray-400 mb-4">
                Relays are servers that store and distribute your posts.
              </p>

              <!-- Add new relay form -->
              <div class="mb-6">
                <div class="flex items-center">
                  <div class="relative flex-grow max-w-md">
                    <input
                      bind:value={newRelayUrl}
                      type="text"
                      placeholder="wss://relay.example.com"
                      class="w-full rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 pr-16"
                    />
                    {#if newRelayUrl}
                      <button
                        class="absolute inset-y-0 right-8 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        on:click={() => {
                          newRelayUrl = "";
                        }}
                        type="button"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    {/if}
                    <button
                      on:click={addRelay}
                      type="button"
                      class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-green-500"
                      title="Add Relay"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {#if showAddRelayError}
                  <div
                    class="fixed inset-0 flex items-center justify-center z-50"
                    on:click={() => (showAddRelayError = false)}
                  >
                    <div class="absolute inset-0 bg-black bg-opacity-30"></div>
                    <div
                      class="relative bg-gray-700 p-4 rounded-lg shadow-lg max-w-md"
                      on:click|stopPropagation
                    >
                      <button
                        class="absolute top-2 right-2 text-gray-400 hover:text-white"
                        on:click={() => (showAddRelayError = false)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </button>
                      <div class="flex items-center">
                        <svg
                          class="flex-shrink-0 w-6 h-6 me-3 text-red-400"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <span
                          class="text-lg font-semibold leading-6 text-white"
                        >
                          {addRelayErrorMessage}
                        </span>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Relay list -->
              <div class="space-y-3 max-w-md">
                {#each relays as relay (relay.url)}
                  <div
                    class="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div class="flex-grow">
                      <p class="text-sm font-medium text-gray-200 break-all">
                        {relay.url}
                      </p>
                      <div class="flex mt-1 space-x-4">
                        <label class="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={relay.read}
                            on:change={() =>
                              toggleRelayPermission(relay.url, "read")}
                            class="form-checkbox h-4 w-4 text-teal-500 rounded accent-teal-500"
                          />
                          <span class="ml-2 text-xs text-gray-400">Read</span>
                        </label>
                        <label class="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={relay.write}
                            on:change={() =>
                              toggleRelayPermission(relay.url, "write")}
                            class="form-checkbox h-4 w-4 text-teal-500 rounded accent-teal-500"
                          />
                          <span class="ml-2 text-xs text-gray-400">Write</span>
                        </label>
                      </div>
                    </div>
                    <button
                      on:click={() => removeRelay(relay.url)}
                      class="text-gray-400 hover:text-red-500 ml-2"
                      disabled={relays.length <= 1}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            </dd>
          </div>

          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">Picture</dt>
            <dd>
              <button on:click={showAvatars}>
                <img
                  class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-gray-100"
                  src={avatar}
                  alt="avatar"
                />
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</main>

<style>
  .copy-button {
    /* background: none; */
    /* border: none; */
    cursor: pointer;
    font-size: 16px;
    padding: 5px;
  }
</style>
