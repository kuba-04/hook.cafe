<script>
  import { getUserProfile, setProfileData } from "$lib/authUtils";
  import Modal from "../../../lib/Modal.svelte";
  import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
  import { onMount } from "svelte";
  import { env } from '$env/dynamic/public';
  import { goto } from "$app/navigation";
  import { getAllAvatars } from "$lib/avatars";
  import PasswordDisplay from "$lib/PasswordDisplay.svelte";
  import citiesData from "../../../lib/cities.json";
  import { page } from '$app/stores';

  let selectedAvatar = "";
  let ndk;
  let name = "";
  let pubKey;
  let privKey;
  let avatar = "";
  let showModal = false;
  let showAlertOnSave = false;
  let hasAlreadySubmitted = false;
  let showAlertOnAlreadySubmitted = false;
  let showAlertOnCopyNpub = false;

  let query = "";
  let results = [];
  let city = null;
  let avatars = [];

  onMount(async () => {
    avatars = getAllAvatars();
    pubKey = $page.params.id;
    if (!pubKey) {
      console.log("not found")
      goto("/");
    }
    privKey = $page.state;
    if (!privKey) {
      console.log("session ends..")
      goto("/");
    }
    const signer = new NDKPrivateKeySigner(privKey);
    ndk = new NDK({ explicitRelayUrls: [env.PUBLIC_RELAY_URL], signer });
    await ndk.connect();

    const user = await signer.user();
    pubKey = user.npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || "";
    city = profile.city || null;
    query = `${city.cityName}, ${city.cityCountry}`;
    avatar = profile.avatar || "";

    await ndk
      .fetchEvents({ kinds: [1], authors: [user.pubkey] })
      .then((events) => {
        if (events.size > 0) {
          hasAlreadySubmitted = true;
        }
      });
  });

  function selectAvatar(av) {
    selectedAvatar = av;
    showModal = false;
    avatar = av;
  }

  async function save() {
    // todo: potentially an alert here
    // if (hasAlreadySubmitted) {
    //   showAlertOnAlreadySubmitted = true;
    //   setTimeout(() => showAlertOnAlreadySubmitted = false, 3000);
    //   return;
    // }
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
      goto("/", {state: privKey});
    } catch (error) {
      console.error("Error saving profile data:", error);
      alert("Failed to save profile data. Please try again.");
    }
  }

  function showAvatars() {
    showModal = true;
  }

  function logout() {
    localStorage.clear();
    goto("/");
  }

  function goBack() {
    goto("/", {state: privKey});
  }

  function searchCities(query) {
    const normalizedQuery = query.toLowerCase().trim();
    results = citiesData
      .filter((city) => city.name.toLowerCase().startsWith(normalizedQuery))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
  }

  function handleInputCity(event) {
    query = event.target.value;
    city = null;
    searchCities(query);
  }

  function selectCity(c) {
    city = { cityName: c.name, cityCountry: c.country };
    query = `${c.name}, ${c.country}`;
    results = [];
  }

  function copyNpub() {
    navigator.clipboard
      .writeText(pubKey)
      .then(() => {
        showAlertOnCopyNpub = true;
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      }).finally(() => setTimeout(() => showAlertOnCopyNpub = false, 1500));
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
          class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-gray-500 dark:text-yellow-300"
          role="alert"
        >
          <svg
            class="flex-shrink-0 inline w-4 h-4 me-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
            />
          </svg>
          <span class="sr-only">Info</span>
          <span class="text-lg font-semibold leading-6 text-white">
            Some fields are not filled!
          </span>
        </div>
      {/if}
      {#if showAlertOnAlreadySubmitted}
        <div
          class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-gray-500 dark:text-yellow-300"
          role="alert"
        >
          <svg
            class="flex-shrink-0 inline w-4 h-4 me-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
            />
          </svg>
          <span class="sr-only">Info</span>
          <span class="text-lg font-semibold leading-6 text-white">
            You can't change the city if already sent request for it. Wait until
            it expires.
          </span>
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
            <input
              bind:value={name}
              id="name"
              name="text"
              type="text"
              required
              class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-1 sm:mt-0 bg-gray-900 dark:hover:bg-gray-600"
              placeholder="Name"
            />
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">City</dt>
            <div class="relative">
              <input
                id="city"
                name="text"
                type="text"
                required
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-1 sm:mt-0 bg-gray-900 dark:hover:bg-gray-600"
                placeholder="City"
                bind:value={query}
                on:input={handleInputCity}
                disabled={hasAlreadySubmitted}
              />
              {#if results.length > 0}
                <div
                  class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                >
                  {#each results as city}
                    <button
                      class="cursor-pointer select-none relative py-2 pl-3 pr-9 text-gray-900 hover:bg-teal-600 hover:text-white"
                      on:click={() => selectCity(city)}
                    >
                      {city.name}, {city.country}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 npub-container">
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
                {pubKey}
              </p>
            </dd>
            <div class="left-10 flex items-center">
              {#if !showAlertOnCopyNpub}
                <button on:click={copyNpub} class="copy-button text-sm text-gray-300"> copy </button>
              {/if}
              {#if showAlertOnCopyNpub}
                <div class="text-sm text-blue-800 rounded-lg dark:text-blue-400" role="alert">
                  <button class="font-medium">copied!</button>
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
                Your password (but cannot be changed!) we recommend you saving
                it in a password manager or keeping secure (you can't log in
                without your key!)
              </p>
              <p
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 break-words"
              >
                <PasswordDisplay password={privKey} />
              </p>
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">Avatar</dt>
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