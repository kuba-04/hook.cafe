<script>
  import { onMount } from "svelte";

  import Modal from '../lib/Modal.svelte';
  import Login from '$lib/Login.svelte';
  
  import { RELAY_URL } from "../lib/Env";
  import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
  import { decryptKey, getUserProfileName, recreateSigner, setName } from "$lib/authUtils";

  let ndk = new NDK({
    explicitRelayUrls: [RELAY_URL],
  });

  let showModal = false;
  let isAuthenticated = false;

  let name = "";
  let privKey = "";
  let signer;

  async function handleRegister(event) {
    name = event.detail.name;
    showModal = false;

    privKey = decryptKey(localStorage.getItem('secure'));
    console.log(privKey)
    
    if (privKey) {
      isAuthenticated = true;
    }

    signer = recreateSigner(privKey);
    
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();

    await setName(ndk);
    const pubKey = (await signer.user()).npub;
    name = await getUserProfileName(ndk, pubKey);
  }

  async function handleLogin(event) {
    privKey = event.detail.privKey;
    showModal = false;

    isAuthenticated = true;

    signer = recreateSigner(privKey);
    
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();
    
    await setName(ndk);
    const pubKey = (await signer.user()).npub;
    name = await getUserProfileName(ndk, pubKey);
  }

  function logout() {
    localStorage.clear();
    isAuthenticated = false;  
  }

  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    const decrypted = decryptKey(localStorage.getItem('secure'));
    
    if (storedUser && decrypted) {
      name = storedUser;
      privKey = decrypted;
      isAuthenticated = true;
    }

    signer = recreateSigner(privKey);
    
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();
  })

  // time picker
  import TimeRangePicker from "../lib/TimeRangePicker.svelte";
  let time_from = "12:00";
  let time_to = "13:00";

  function handleTimeRangeChange(event) {
    time_from = event.detail.startTime;
    time_to = event.detail.endTime;
    fieldsArray[5] = time_from;
    fieldsArray[6] = time_to;
  }

  // async function getLastEvent() {
  //   await ndk.connect();
  //   let res = await ndk.fetchEvent(filter);
  //   if (res?.isValid) {
  //     return res.content.toString();
  //   } else {
  //     throw new Error("no events found");
  //   }
  // }

  async function getEvents() {
    await ndk.connect();
    let filter = { kinds: [1], limit: 10 };
    let res = await ndk.fetchEvents(filter);
    if (res.size > 0) {
      const sortedEvents = Array.from(res).sort((a, b) => {
        // Convert timestamps to Date objects
        const dateA = new Date(a.created_at).getDate();
        const dateB = new Date(b.created_at).getDate();
        
        // Sort in descending order (most recent first)
        return dateB - dateA;
      });
      return sortedEvents;
    } else {
      throw new Error("no events found");
    }
  }

  // todo: try to subscribe so it will recieve new notes
  let eventsPromise = getEvents();

  function parseEventContent(event) {
    return {
      ...event,
      parsedContent: event.content.split('|')
    };
  }



  // price slider
  import Slider from "../lib/Slider.svelte";
  let minValue;
  let maxValue;

  // prepare the note
  let inputWord1 = "";
  let inputWord2 = "";
  let inputWord3 = "";
  let inputWord4 = "";
  let inputCity = "";
  /**
   * @type {boolean}
   */
  let isMessageValid;
  /**
   * @type {any[]}
   */
  let fieldsArray = [
    "",
    "",
    "",
    "",
    inputCity,
    time_from,
    time_to,
    minValue,
    maxValue,
  ];
  /**
   * @type {String}
   */
  let message = fieldsArray.join("|");

  function onChangeWord1() {
    fieldsArray[0] = inputWord1;
    updateMessage();
  };

  function onChangeWord2() {
    fieldsArray[1] = inputWord2;
    updateMessage();
  };

  function onChangeWord3() {
    fieldsArray[2] = inputWord3;
    updateMessage();
  };

  function onChangeWord4() {
    fieldsArray[3] = inputWord4;
    updateMessage();
  };

  function onChangeCity() {
    fieldsArray[4] = inputCity;
    updateMessage();
  };

  function updateMessage() {
    message = fieldsArray.join("|");
    isMessageValid =
      inputWord1.trim().length > 0 &&
      inputWord2.trim().length > 0 &&
      inputWord3.trim().length > 0 &&
      inputWord4.trim().length > 0 &&
      inputCity.trim().length > 0;
  };

  async function handleSubmit() {
    let loading = true;
    fieldsArray[7] = minValue.toString();
    fieldsArray[8] = maxValue.toString();
    message = fieldsArray.join("|");

    try {
      sendMessage(message);
    } catch (error) {
      console.log(error);
    } finally {
      loading = false;
    }
  }

  async function sendMessage(message) {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 1;
    ndkEvent.content = message;
    ndkEvent.publish();
  }
</script>

<main>
  {#if showModal}
  <Modal bind:showModal>
    <Login 
      on:register={handleRegister} 
      on:login={handleLogin}
    />
  </Modal>
  {/if}
  <div
    class="relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32"
  >
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      {#if isAuthenticated}
        <div class="absolute top-0 right-0 h-16 w-16">
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <a href="/profile">Hi, {name}!</a>
          </p>
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <button on:click={logout}>Log out</button>
          </p>
        </div>  
      {:else}
        <div class="absolute top-0 right-0 h-16 w-16">
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <button on:click={() => (showModal = true)}>Login</button>
          </p>
        </div>
      {/if}  
      <!-- <Auth /> -->
      <!-- {#if $isAuthenticated}
      {:else}
      {/if} -->
      <div
        class="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2"
      >
        <div class="max-w-xl lg:max-w-lg">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What do you want to talk about today?
          </h2>
          <p class="mt-4 text-lg leading-8 text-gray-300">Your 4 words:</p>
          <div class="mt-6 flex max-w-md gap-x-4">
            <label for="word-1" class="sr-only">Word 1</label>
            <input
              bind:value={inputWord1}
              on:change={onChangeWord1}
              id="word-1"
              name="text"
              type="text"
              required
              class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Word 1"
            />

            <label for="word-2" class="sr-only">Word 2</label>
            <input
              bind:value={inputWord2}
              on:change={onChangeWord2}
              id="word-2"
              name="text"
              type="text"
              required
              class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Word 2"
            />

            <label for="word-3" class="sr-only">Word 3</label>
            <input
              bind:value={inputWord3}
              on:change={onChangeWord3}
              id="word-3"
              name="text"
              type="text"
              required
              class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Word 3"
            />

            <label for="word-4" class="sr-only">Word 4</label>
            <input
              bind:value={inputWord4}
              on:change={onChangeWord4}
              id="word-4"
              name="text"
              type="text"
              required
              class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Word 4"
            />
          </div>
          <p class="mt-4 text-lg leading-8 text-gray-300">Your location:</p>
          <!-- city -->
          <div class="mt-6 flex-direction max-w-md gap-x-4">
            <label for="city" class="sr-only">City</label>
            <input
              bind:value={inputCity}
              on:change={onChangeCity}
              id="city"
              name="text"
              type="text"
              required
              class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="City"
            />
          </div>
          <p class="mt-4 text-lg leading-8 text-gray-300">Your meal time:</p>
          <!-- timepicker -->
          <div class="mt-6 flex max-w-md gap-x-4">
            <span
              id="time-from"
              class="min-w-0 flex-direction rounded-md border-0 bg-white/5 px-3.5 py-2 text-black shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
            >
              <TimeRangePicker
                bind:startTime={time_from}
                bind:endTime={time_to}
                on:change={handleTimeRangeChange}
              />
            </span>
          </div>
          <p class="mt-4 text-lg leading-8 text-gray-300">Your meal budget:</p>
          <div class="mt-6 flex max-w-md gap-x-4">
            <span class="mt-4 text-lg leading-8 text-gray-300">{minValue}</span>
            <Slider bind:minValue bind:maxValue />
            <span class="mt-4 text-lg leading-8 text-gray-300">{maxValue}</span>
          </div>

          <div>
            {#if isMessageValid}
              <button
                on:click={handleSubmit}
                disabled={!isMessageValid}
                type="submit"
                class="float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
              >
                Submit
              </button>
              <!-- {:else if loading }
                  <p>Loading...</p> -->
            {/if}
          </div>
        </div>
        <dl class="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-1 lg:pt-2">
          {#await eventsPromise}
            <p>...waiting</p>
          {:then events}
            <ul role="list" class="divide-y divide-gray-100">
              {#each events.map(parseEventContent) as content}
                <li class="flex justify-between gap-x-6 py-5">
                  <div class="flex min-w-0 gap-x-4">
                    <!-- <img class="h-12 w-12 flex-none rounded-full bg-gray-50" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt=""> -->
                    <div class="min-w-0 flex-auto">
                      <p class="text-sm font-semibold leading-6 text-white">
                        {content.parsedContent[0]} {content.parsedContent[1]} {content.parsedContent[2]} {content.parsedContent[3]}
                      </p>
                      <p class="mt-1 truncate text-xs leading-5 text-gray-500">leslie.alexander@example.com</p>
                    </div>
                  </div>
                  <div class="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
                    <p class="text-sm leading-6 text-gray-200">{content.parsedContent[4]} | {content.parsedContent[5]} - {content.parsedContent[6]}</p>
                    <!-- <p class="mt-1 text-xs leading-5 text-gray-500">Last seen <time datetime="2023-01-23T13:23Z">3h ago</time></p> -->
                  </div>
                </li>
              {/each}
            </ul>
          {:catch error}
            <p style="color: red">{error.message}</p>
          {/await}
        </dl>
      </div>
    </div>
    <div
      class="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl xl:-top-6"
      aria-hidden="true"
    >
      <div
        class="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30"
        style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
      ></div>
    </div>
  </div>

</main>

<!-- <style lang="postcss">
  :global(html) {
    background-color: theme(colors.gray.100);
  }
</style> -->
