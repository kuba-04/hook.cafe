<script>
  import { onDestroy, onMount } from "svelte";

  import Modal from "../lib/Modal.svelte";
  import Login from "$lib/Login.svelte";

  import { RELAY_URL } from "../lib/Env";
  import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
  import {
    decryptKey,
    encryptKey,
    getUserProfile,
    recreateSigner,
    setProfileData,
  } from "$lib/authUtils";

  let ndk = new NDK({
    explicitRelayUrls: [RELAY_URL],
  });

  let showModal = false;
  let isAuthenticated = false;

  let name = "";
  let avatar = "";
  let privKey = "";
  let signer;
  let subscription;
  let messages = [];
  let userProfiles = new Map();
  let submitted = null;
  let selectedAuthor = "";

  let showAlertOnSelectUnsubmitted = false;
  let showAlertOnSubmittingInvalid = false;

  async function handleRegister(event) {
    name = event.detail.name;
    avatar = event.detail.avatar;
    showModal = false;

    privKey = decryptKey(localStorage.getItem("secure"));

    if (privKey) {
      isAuthenticated = true;
    }

    signer = recreateSigner(privKey);

    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();

    await setProfileData(ndk, name, avatar);

    const pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || '';
    avatar = profile.avatar || '';

    await initMessages();
  }

  async function handleLogin(event) {
    privKey = event.detail.privKey;
    localStorage.setItem('secure', encryptKey(privKey));
    signer = recreateSigner(privKey);
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });
    await ndk.connect();
    isAuthenticated = true;
    showModal = false;

    const pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || '';
    avatar = profile.avatar || '';

    await loadOwnEvents();
    if (selectedAuthor.length > 0) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  }

  async function loadOwnEvents() {
    const currentUserKey = (await signer.user()).pubkey;
    const fetchSelectedFilter = { kinds: [1], authors: [currentUserKey] };
    const submittedEvents = await ndk.fetchEvents(fetchSelectedFilter);
    submittedEvents.forEach(e => {
      if (isRootNote(e)) {
        submitted = e;
        localStorage.setItem('myEvent', e);
      } else if (isReplyNote(e)) {
        selectedAuthor = e.tagValue('p') || '';
        localStorage.setItem('selected', selectedAuthor);
      }
    });
  }

  onMount(async () => {
    const storedKey = localStorage.getItem("secure");
    if (storedKey !== null) {
      privKey = decryptKey(storedKey);
      signer = recreateSigner(privKey);
      isAuthenticated = true;
    } else {
      return;
    }
    selectedAuthor = localStorage.getItem('selected') || "";
    
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });
    
    await ndk.connect();
    await loadOwnEvents();

    const pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    avatar = profile.avatar || "";

    if (selectedAuthor.length > 0) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  });

  function isRootNote(event) {
    return event.kind === 1 && !event.tags.some(tag => tag[0] === 'e');
  }

  function isReplyNote(event) {
    return event.kind === 1 && event.tags.some(tag => tag[0] === 'e');
  }

  async function initMessages() {
    const profileFilter = {kinds: [0] };
    const subscribeFilter = { kinds: [1] };
    const fetchFilter = { kinds: [1] };
    subscription = ndk.subscribe([subscribeFilter, profileFilter], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      if (isRootNote(event)) {
        addMessage(event);
      }
    });
    ndk.fetchEvents([fetchFilter]).then(events => {
      for (const event of events) {
        if (isRootNote(event)) {
          addMessage(event);
        }
      }
    })
  };

  async function initConnectedMessages() {
    const profileFilter = {kinds: [0] };
  
    // 1. selected and its parent
    let selectedNote;
    let selectedParentNote;
    const fetchSelectedFilter = { kinds: [1], authors: [selectedAuthor] };
    await ndk.fetchEvents(fetchSelectedFilter).then(
      notes => notes.forEach(e => {
      if (isRootNote(e)) {
        selectedNote = e;
        localStorage.setItem('myEvent', e);
      }
    }));

    // 2. replies to selected
    const generalFilter = { kinds: [1] };
    let selectedReplyNotes = [];
    const repliesToSelected = await ndk.fetchEvents(generalFilter);
    for (const note of repliesToSelected) {
      if (note.getMatchingTags('e', selectedAuthor) !== null) {
        selectedReplyNotes.push(note)
        }
    }
    
    // TODO check this out
    // 3. replies to mine 
    const currentUserKey = (await signer.user()).pubkey;
    let toMineReplyNotes = [];
    const repliesToMine = await ndk.fetchEvents(generalFilter);
    for (const note of repliesToMine) {
      if (note.getMatchingTags('e', currentUserKey) !== null) {
        toMineReplyNotes.push(note)
      }
    }

    subscription = ndk.subscribe([generalFilter,  profileFilter], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      if (isReplyNote(event)) {
        // all root events for each selection/reply
        const selectedParentKey = event.tagValue('p') || '';
        ndk.fetchEvents({ kinds: [1], authors: [selectedParentKey] })
        .then(p => p.forEach(note => {
          if (isRootNote(note)) {
              addMessage(note);
            }
          })
        )
      }
    });
    
    const allNotes = new Set([...selectedReplyNotes, ...toMineReplyNotes]);
    
    for (const event of allNotes) {
      addMessage(selectedNote);
      addMessage(selectedParentNote);
      if (isReplyNote(event)) {
        addMessage(event);
      }
    }
  };

  onDestroy(() => {
    if (subscription) {
      subscription.stop();
    }
  });

  async function addMessage(event) {
    const idExists = messages.some(m => m.id === event.id);
    const pubkeyExists = messages.some(m => m.pubkey === event.pubkey);
    if (!idExists && !pubkeyExists) {
      messages = [{ ...event, author: null }, ...messages].sort((a, b) => b.created_at - a.created_at);
      await fetchUserProfile(event.pubkey);
    }
  }

  async function fetchUserProfile(pubkey) {
    if (userProfiles.has(pubkey)) return;    
    const user = ndk.getUser({ pubkey: pubkey });
    await user.fetchProfile();
    const profile = user.profile;
    userProfiles.set(pubkey, profile);
    await updateMessagesWithProfile(pubkey, profile);
  }

  async function updateMessagesWithProfile(pubkey, profile) {
    messages = messages.map(msg => 
      msg.pubkey === pubkey ? { ...msg, author: profile } : msg
    );
  }

  async function select(event) {
    if (selectedAuthor.length > 0) {
      return;
    }
    if (submitted === null) {
      showAlertOnSelectUnsubmitted = true;
      setTimeout(() => showAlertOnSelectUnsubmitted = false, 2000);
      return;
    }
    const eventAuthorKey = event.pubkey;
    const currentUserKey = (await signer.user()).pubkey;
    if (eventAuthorKey === currentUserKey) {
      console.log("You can't select yourself!");
      return;
    }
    selectedAuthor = eventAuthorKey;
    localStorage.setItem('selected', eventAuthorKey);
    const ownNoteFilter = { kinds: [1], authors: [currentUserKey] };
    const ownEvent = await ndk.fetchEvent(ownNoteFilter);
    const replyEvent = new NDKEvent(ndk);
    replyEvent.kind = 1;
    replyEvent.tags = [
        ['e', event.id],
        ['p', event.pubkey]
      ];
    replyEvent.content = ownEvent?.content || '';
    replyEvent.publish().then(() => {
      messages = [];
      userProfiles.clear();
      initConnectedMessages();
      }
    );
  }

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

  function parseEventContent(event) {
    return {
      ...event,
      parsedContent: event.content.split("|"),
    };
  }

  // price slider
  import Slider from "../lib/Slider.svelte";
  import { goto } from "$app/navigation";
  import NostriChat from "$lib/NostriChat.svelte";
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
  }

  function onChangeWord2() {
    fieldsArray[1] = inputWord2;
    updateMessage();
  }

  function onChangeWord3() {
    fieldsArray[2] = inputWord3;
    updateMessage();
  }

  function onChangeWord4() {
    fieldsArray[3] = inputWord4;
    updateMessage();
  }

  function onChangeCity() {
    fieldsArray[4] = inputCity;
    updateMessage();
  }

  function updateMessage() {
    message = fieldsArray.join("|");
    isMessageValid =
      inputWord1.trim().length > 0 &&
      inputWord2.trim().length > 0 &&
      inputWord3.trim().length > 0 &&
      inputWord4.trim().length > 0 &&
      inputCity.trim().length > 0;
  }

  async function handleSubmit() {
    const currentUserKey = (await signer.user()).pubkey;
    const alreadyAdded = messages.map(e => e.pubkey).includes(currentUserKey);
    if (alreadyAdded) {
      alert("You can add only one request per day!"); // todo replace
      return;
    }
    
    let loading = true;
    fieldsArray[7] = minValue.toString();
    fieldsArray[8] = maxValue.toString();
    message = fieldsArray.join("|");

    if (!isMessageValid) {
      showAlertOnSubmittingInvalid = true;
      setTimeout(() => showAlertOnSubmittingInvalid = false, 1500);
      return;
    }

    try {
      submitted = await sendMessage(message);
      localStorage.setItem('myEvent', submitted);
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
    return ndkEvent;
  }

</script>


<main>
  <div>
    <NostriChat></NostriChat>
  </div>
  {#if showModal}
    <Modal bind:showModal>
      <Login on:register={handleRegister} on:login={handleLogin} />
    </Modal>
  {/if}
  <div
    class="relative isolate overflow-hidden bg-gray-900 py-16 sm:py-24 lg:py-32"
  >
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      {#if isAuthenticated}
        <div class="absolute top-0 right-0 h-16 w-16">
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <a href="/profile">
              <img
                class="w-12 h-12 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-gray-100"
                src={avatar}
                alt="avatar"
                on:click={() => goto('/profile')}
              />  
            </a>
          </p>
        </div>
      <!-- {:else}
        <div class="absolute top-0 right-0 h-16 w-16">
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <button on:click={() => (showModal = true)}>Login</button>
          </p>
        </div> -->
      {/if}
      <div
        class={submitted ? "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-1" : "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2"}
      >

        <!-- form -->
        {#if !submitted}
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
          <p class="mt-4 text-lg leading-8 text-gray-300">Where you can meet?</p>
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
              placeholder="District or street"
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

          <!-- alert -->
          {#if showAlertOnSubmittingInvalid}
            <div class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-500 dark:text-yellow-300" role="alert">
              <svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
              </svg>
              <span class="sr-only">Info</span>
              <span class="text-lg font-semibold leading-6 text-white">
                Please fill out all the fields!
              </span>
            </div>
          {/if}

          <div>
            {#if isAuthenticated}
              <button
                on:click={handleSubmit}
                type="submit"
                class="float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
              >
                Submit
              </button>
            {:else }
              <button
                on:click={() => showModal = true}
                type="submit"
                class="float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
              >
              Start
            </button>
            {/if}
          </div>
        </div>
        {/if}
        <!-- end form -->
        <!-- list -->
        <dl class="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-1 lg:pt-2">
          {#if showAlertOnSelectUnsubmitted}
            <div class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-500 dark:text-yellow-300" role="alert">
              <svg class="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
              </svg>
              <span class="sr-only">Info</span>
              <span class="text-lg font-semibold leading-6 text-white">
                Before selecting, submit your own request!
              </span>
            </div>
          {/if}
          <ul role="list" class="divide-y divide-gray-100">
            {#each messages as message (message.id)}
              <li on:click={select(message)} class="flex justify-between gap-x-6 py-5 hover:bg-gray-600 cursor-pointer">
                <div class="flex min-w-0 gap-x-4">
                  <img class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200" src="{message.author?.avatar}" alt="">
                  <div class="min-w-0 flex-auto">
                    <p class="text-sm font-semibold leading-6 text-white">
                      {parseEventContent(message).parsedContent[0]}
                        {parseEventContent(message).parsedContent[1]}
                        {parseEventContent(message).parsedContent[2]}
                        {parseEventContent(message).parsedContent[3]}
                    </p>
                    <p class="mt-1 truncate text-xs leading-5 text-gray-500">
                      {message.author?.name}
                    </p>
                  </div>
                </div>
                <div class="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
                  <p class="text-sm leading-6 text-gray-200">
                    {parseEventContent(message).parsedContent[4]} @ {parseEventContent(message).parsedContent[5]} - {parseEventContent(message).parsedContent[6]}
                  </p>
                  <small class="text-xs leading-6 text-gray-400">
                    added {new Date(message.created_at * 1000).toLocaleTimeString()}
                  </small>
                  <!-- <p class="mt-1 text-xs leading-5 text-gray-500">Last seen <time datetime="2023-01-23T13:23Z">3h ago</time></p> -->
                </div>
              </li>
            {/each}
          </ul>
        </dl>
        <!-- end list -->
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
