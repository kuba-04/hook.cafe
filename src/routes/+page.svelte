<script>
  import { onMount } from "svelte";

  import Modal from "../lib/Modal.svelte";
  import Login from "$lib/Login.svelte";
  import Slider from "../lib/Slider.svelte";
  import { goto } from "$app/navigation";
  import { RELAY_URL } from "../lib/Env";
  import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
  import {
    getUserProfile,
    recreateSigner,
    setProfileData,
  } from "$lib/authUtils";
  import { nip19 } from "nostr-tools";
  import TimeRangePicker from "../lib/TimeRangePicker.svelte";
  import Chat from "$lib/Chat/Chat.svelte";
  import { page } from "$app/stores";

  const PROFILE_FILTER = { kinds: [0] };
  const KIND_1_FILTER = { kinds: [1] };
  const KIND_40_FILTER = { kinds: [40] };

  let ndk;
  let showModal = false;
  let isAuthenticated = false;
  let name = "";
  let city = null;
  let avatar = "";
  let privKey = null;
  let pubKey = "";
  let signer;
  let subscription;
  let messages = [];
  let userProfiles = new Map();
  let submitted = null;
  let selectedAuthor = "";
  let channelId = null;
  let chatOpen = null;

  // price slider
  let minValue;
  let maxValue;

  // time picker
  let timeFrom = "12:00";
  let timeTo = "13:00";

  // prepare the note
  let inputWord1 = "";
  let inputWord2 = "";
  let inputWord3 = "";
  let inputWord4 = "";
  let inputLocation = "";

  let isMessageValid = false;
  let message = {};

  let showAlertOnSelectUnsubmitted = false;
  let showAlertOnSubmittingInvalid = false;
  let showAlertOnAlreadySubmitted = false;
  let showAlertOnSubmittingSuccess = false;
  let showAlertOnSelectingSelf = false;
  let showAlertOnPageReload = false;

  async function handleRegister(event) {
    name = event.detail.name;
    city = event.detail.city;
    avatar = event.detail.avatar;
    privKey = event.detail.privKey;

    if (privKey) {
      isAuthenticated = true;
      showModal = false;
    }

    signer = recreateSigner(privKey);

    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();

    await setProfileData(ndk, name, city, avatar);

    pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || "";
    city = profile.city || null;
    avatar = profile.avatar || "";

    // if stared adding request we will try to submit it after the registration
    if (isMessageValid) {
      await handleSubmit();
    }

    await initMessages();
  }

  async function handleLogin(event) {
    privKey = event.detail.privKey;
    signer = recreateSigner(privKey);
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });
    await ndk.connect();
    isAuthenticated = true;
    showModal = false;

    pubKey = (await signer.user()).npub; // todo: pubkey
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || "";
    city = profile.city || null;
    avatar = profile.avatar || "";

    await loadOwnEvents();
    if (selectedAuthor.length > 0) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  }

  async function loadOwnEvents() {
    const currentUserKey = (await signer.user()).pubkey; // todo: refactor all those currentUserKeys
    const fetchSelectedFilter = { kinds: [1], authors: [currentUserKey] };
    const submittedEvents = await ndk.fetchEvents(fetchSelectedFilter);
    submittedEvents.forEach((e) => {
      if (isRootNote(e)) {
        submitted = e;
      } else if (isReplyNote(e)) {
        selectedAuthor = e.tagValue("p") || "";
        localStorage.setItem("selected", selectedAuthor);
      }
    });
  }

  function handleBeforeUnload(event) {
    showAlertOnPageReload = true;
    setTimeout(() => showAlertOnPageReload = false, 4000);
    event.preventDefault();
  }

  onMount(async () => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    const preloadKey = $page.state;
    if (Object.keys(preloadKey).length === 0) {
      return;
    } else {
      privKey = preloadKey;
    }

    if (privKey) {
      signer = recreateSigner(privKey);
      isAuthenticated = true;
    } else {
      isAuthenticated = false;
      showModal = true;
      return;
    }
    selectedAuthor = localStorage.getItem("selected") || "";

    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer: signer,
    });

    await ndk.connect();
    await loadOwnEvents();

    pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    avatar = profile.avatar || "";
    name = profile.name || "";
    city = profile.city || null;

    if (selectedAuthor.length > 0) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }

    

    // return () => {
    //   window.removeEventListener('beforeunload', handleBeforeUnload);
    // };
  });

  function isRootNote(event) {
    return event.kind === 1 && !event.tags.some((tag) => tag[0] === "e");
  }

  // TODO: replace with eventIsReply
  function isReplyNote(event) {
    return event.kind === 1 && event.tags.some((tag) => tag[0] === "e");
  }

  async function initMessages() {
    subscription = ndk.subscribe([KIND_1_FILTER, PROFILE_FILTER], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      const eventCity = JSON.parse(event.content).city;
      if (isRootNote(event) && isTheSameCity(city, eventCity)) {
        addMessage(event);
      }
    });
    ndk.fetchEvents([KIND_1_FILTER]).then((events) => {
      for (const event of events) {
        const eventCity = JSON.parse(event.content).city;
        if (isRootNote(event) && isTheSameCity(city, eventCity)) {
          addMessage(event);
        }
      }
    });
  }

  function isTheSameCity(city1, city2) {
    return (
      city1.cityName === city2.cityName &&
      city1.cityCountry === city2.cityCountry
    );
  }

  async function initConnectedMessages() {
    // 1. selected and its parent
    await ndk
      .fetchEvents({ kinds: [1], authors: [selectedAuthor] })
      .then((notes) =>
        notes.forEach((e) => {
          // selected
          if (isRootNote(e)) {
            addMessage(e);
          } else {
            // and his parent:
            const selectedParentKey = e.tagValue("p");
            ndk
              .fetchEvents({ kinds: [1], authors: [selectedParentKey] })
              .then((p) =>
                p.forEach((note) => {
                  if (isRootNote(note)) {
                    addMessage(note);
                  }
                })
              );
          }
        })
      );

    // 3. replies: to mine & to selected
    const currentUserKey = signer.user().pubkey;
    ndk.fetchEvents(KIND_1_FILTER).then((notes) => {
      notes.forEach((note) => {
        if (
          isReplyNote(note) &&
          (note.getMatchingTags("e", currentUserKey) !== null ||
            note.getMatchingTags("e", selectedAuthor) !== null)
        ) {
          addMessage(note);
        }
      });
    });

    subscription = ndk.subscribe([KIND_1_FILTER, PROFILE_FILTER], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      if (isReplyNote(event)) {
        // selected author has to sub my note:
        await addMessage(event);
        // and we have to add the parent's note:
        const selectedParentKey = event.tagValue("p");
        await ndk
          .fetchEvents({ kinds: [1], authors: [selectedParentKey] })
          .then((p) =>
            p.forEach((note) => {
              if (isRootNote(note)) {
                addMessage(note);
              }
            })
          );
      }

      // todo: question if it is required to subscribe to a chat
    });
  }

  async function addMessage(event) {
    const eventPubkey = event.pubkey;

    const idExists = messages.some((m) => m.id === event.id);
    const pubkeyExists = messages.some((m) => m.pubkey === eventPubkey);
    const eventCity = JSON.parse(event.content).city;
    if (!idExists && !pubkeyExists && isTheSameCity(city, eventCity)) {
      messages = [{ ...event, author: null }, ...messages].sort(
        (a, b) => b.created_at - a.created_at
      );
      await fetchUserProfile(eventPubkey);
    }
  }

  async function fetchUserProfile(eventPubkey) {
    if (userProfiles.has(eventPubkey)) return;
    const user = ndk.getUser({ pubkey: eventPubkey });
    await user.fetchProfile();
    const profile = user.profile;
    userProfiles.set(eventPubkey, profile);
    validateMessagesWithProfile(eventPubkey, profile);
  }

  function validateMessagesWithProfile(eventPubkey, profile) {
    messages = messages.map((msg) =>
      msg.pubkey === eventPubkey ? { ...msg, author: profile } : msg
    );
  }

  async function select(event) {
    if (selectedAuthor.length > 0) {
      return;
    }
    if (submitted === null) {
      showAlertOnSelectUnsubmitted = true;
      setTimeout(() => (showAlertOnSelectUnsubmitted = false), 2000);
      return;
    }
    const eventAuthorKey = event.pubkey;
    const currentUserKey = (await signer.user()).pubkey;
    if (eventAuthorKey === currentUserKey) {
      showAlertOnSelectingSelf = true;
      setTimeout(() => (showAlertOnSelectingSelf = false), 2000);
      return;
    }
    selectedAuthor = eventAuthorKey;
    localStorage.setItem("selected", eventAuthorKey);
    const ownNoteFilter = { kinds: [1], authors: [currentUserKey] };
    const ownEvent = await ndk.fetchEvent(ownNoteFilter);
    const replyEvent = new NDKEvent(ndk);
    replyEvent.kind = 1;
    replyEvent.tags = [
      ["e", event.id],
      ["p", event.pubkey],
    ];
    replyEvent.content = ownEvent?.content || "";
    messages = [];
    replyEvent.publish().then(() => {
      userProfiles.clear();
      initConnectedMessages();
    });
  }

  // TODO why is it calling so many times??
  function parseEventContent(event) {
    return {
      ...event,
      parsedContent: JSON.parse(event.content),
    };
  }

  function parseInputWord(word) {
    let parsedWord = word.trim();
    const cut = parsedWord.includes(" ") ? parsedWord.indexOf(" ") : 20;
    return parsedWord.substring(0, cut);
  }

  function onChangeWord1() {
    message.word1 = parseInputWord(inputWord1);
    validateMessage();
  }

  function onChangeWord2() {
    message.word2 = parseInputWord(inputWord2);
    validateMessage();
  }

  function onChangeWord3() {
    message.word3 = parseInputWord(inputWord3);
    validateMessage();
  }

  function onChangeWord4() {
    message.word4 = parseInputWord(inputWord4);
    validateMessage();
  }

  function onChangeLocation() {
    message.location = inputLocation.substring(0, 20);
    validateMessage();
  }

  function handleTimeRangeChange(event) {
    timeFrom = event.detail.startTime;
    timeTo = event.detail.endTime;
  }

  function validateMessage() {
    isMessageValid =
      inputWord1.trim().length > 0 &&
      inputWord2.trim().length > 0 &&
      inputWord3.trim().length > 0 &&
      inputWord4.trim().length > 0 &&
      inputLocation.trim().length > 0;
  }

  async function handleSubmit() {
    if (submitted) {
      showAlertOnAlreadySubmitted = true;
      setTimeout(() => (showAlertOnAlreadySubmitted = false), 1500);
      return;
    }

    let loading = true;
    message.minPrice = minValue.toString();
    message.maxPrice = maxValue.toString();
    message.timeFrom = timeFrom;
    message.timeTo = timeTo;
    message.city = city;

    if (!isMessageValid) {
      showAlertOnSubmittingInvalid = true;
      setTimeout(() => (showAlertOnSubmittingInvalid = false), 1500);
      return;
    }

    try {
      submitted = await sendMessage(message);
    } catch (error) {
      console.log(error);
    } finally {
      loading = false;
      showAlertOnSubmittingSuccess = true;
      setTimeout(() => (showAlertOnSubmittingSuccess = false), 5000);
    }
  }

  async function sendMessage(message) {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 1;
    ndkEvent.content = JSON.stringify(message);
    ndkEvent.publish();
    return ndkEvent;
  }

  async function openOrJoinChat() {
    if (!channelId) {
      const allChannels = await ndk.fetchEvents(KIND_40_FILTER);
      const channelEvent = [...allChannels].filter((event) =>
        userProfiles.has(event.pubkey)
      )[0];
      if (channelEvent) {
        channelId = channelEvent.id;
        chatOpen = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        console.log("creating a new channel..");
        let channelContent = {};
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = 40;

        channelContent.name = city.cityName + "_group";
        channelContent.about = "let's meet in real life!";
        channelContent.relays = RELAY_URL;
        ndkEvent.content = JSON.stringify(channelContent);

        ndkEvent.publish().then((ok) => {
          ndk.fetchEvents(KIND_40_FILTER).then((allLatestChannels) => {
            const latestChannelEvent = [...allLatestChannels].filter((event) =>
              userProfiles.has(event.pubkey)
            )[0];
            if (latestChannelEvent) {
              channelId = latestChannelEvent.id;
              console.log("joining channel...");
              chatOpen = true;
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          });
        });
      }
    } else {
      console.log("joining channel...");
      chatOpen = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // todo remove this
  function decodedKey() {
    return nip19.decode(pubKey).data;
  }

  function navigateToProfile() {
    const id = pubKey;
    goto(`/profile/${id}`, { state: privKey });
  }
</script>

<main>
  {#if showModal}
    <Modal bind:showModal>
      <Login on:register={handleRegister} on:login={handleLogin} />
    </Modal>
  {/if}
  <div
    class="relative isolate overflow-hidden bg-gray-900 min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8"
  >
  <!-- alert -->
  {#if showAlertOnPageReload}
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
        Page refresh will log you out. Did you keep your private key safe?
      </span>
    </div>
  {/if}
    <div class="w-full max-w-4xl py-16 sm:py-24 lg:py-32">
      {#if isAuthenticated}
        {#if selectedAuthor.length > 0}
          <div class="absolute top-5 left-10 items-center">
            <p class="text-lg text-gray-300">
              Building {city?.cityName} group<span class="animate-ping"
                >...</span
              >
            </p>
          </div>
        {:else if submitted && city?.cityName}
          <div class="absolute top-5 left-10 items-center">
            <p class="text-lg text-gray-300">
              Hello {city?.cityName} people!<br class="md:hide" />
            </p>
          </div>
        {/if}
        <div class="absolute top-0 right-10 h-16">
          <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
            <button>
              <img
                class="w-12 h-12 p-1 rounded-full ring-2 hover:ring-0 ring-gray-300 hover:bg-yellow-100"
                src={avatar}
                alt="avatar"
                on:click={navigateToProfile}
              />
            </button>
          </p>
        </div>
      {/if}

      

      <div
        class={(submitted || !isAuthenticated) && !chatOpen
          ? "mx-auto grid max-w-2xl grid-cols-1 gap-x-8  lg:max-w-none lg:grid-cols-1"
          : "mx-auto grid max-w-2xl grid-cols-1 lg:max-w-none lg:grid-cols-2"}
      >
        <!-- form -->
        {#if !submitted}
          <div class="flex flex-col place-content-center">
            <div class="max-w-xl lg:max-w-lg">
              <h2
                class="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
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
              <p class="mt-4 text-lg leading-8 text-gray-300">
                Where you can meet?
              </p>
              <!-- location -->
              <div class="mt-6 flex-direction max-w-md gap-x-4">
                <label for="location" class="sr-only">Location</label>
                <input
                  bind:value={inputLocation}
                  on:change={onChangeLocation}
                  id="location"
                  name="text"
                  type="text"
                  required
                  class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-3.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  placeholder="District or street"
                />
              </div>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                Your meal time:
              </p>
              <!-- timepicker -->
              <div class="mt-6 flex max-w-md gap-x-4">
                <span
                  id="time-from"
                  class="min-w-0 flex-direction rounded-md border-0 bg-white/5 px-3.5 py-2 text-black shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                >
                  <TimeRangePicker
                    bind:startTime={timeFrom}
                    bind:endTime={timeTo}
                    on:change={handleTimeRangeChange}
                  />
                </span>
              </div>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                Your meal budget:
              </p>
              <div class="mt-6 flex max-w-md gap-x-4">
                <span class="mt-4 text-lg leading-8 text-gray-300"
                  >{minValue}</span
                >
                <Slider bind:minValue bind:maxValue />
                <span class="mt-4 text-lg leading-8 text-gray-300"
                  >{maxValue}</span
                >
              </div>

              <!-- alert -->
              {#if showAlertOnSubmittingInvalid}
                <div
                  class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 bg-gray-500 dark:text-yellow-300"
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
                    Please fill out all the fields!
                  </span>
                </div>
              {/if}
              <!-- alert -->
              {#if showAlertOnAlreadySubmitted}
                <div
                  class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 bg-gray-500 dark:text-yellow-300"
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
                    You already sent your message!
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
                {:else}
                  <button
                    on:click={() => (showModal = true)}
                    type="submit"
                    class="mt-5 float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  >
                    Start
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        <!-- end form -->

        <!-- chat -->
        {#if chatOpen}
          <div
            class="bg-gray-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8"
          >
            <div class="max-w-4xl max-y-md py-16 sm:py-24 lg:py-32">
              <Chat {ndk} username={name} {channelId} signerKey={decodedKey()}
              ></Chat>
            </div>
          </div>
        {/if}

        <!-- alert -->
        {#if showAlertOnSubmittingSuccess}
          <div
            class="flex items-center p-4 mb-4 text-sm text-green-800 rounded-lg bg-gray-800 dark:text-green-400"
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
            <div class="text-lg font-semibold leading-6 text-white">
              <span class="font-medium">Great!</span> Now select one person to join
              your table, or wait until they appear 🙂
            </div>
            <button
              on:click={() => (showAlertOnSubmittingSuccess = false)}
              type="button"
              class="ms-auto -mx-1.5 -my-1.5 bg-blue-50 text-blue-500 rounded-lg focus:ring-2 focus:ring-blue-400 p-1.5 hover:bg-blue-200 inline-flex items-center justify-center h-8 w-8 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
              data-dismiss-target="#alert-1"
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
        {/if}

        {#await initConnectedMessages}
          <p>Loading...</p>
          <!-- Loader displayed while waiting -->
        {:then _}
          <!-- list -->
          <dl class="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-1 lg:pt-2">
            {#if showAlertOnSelectUnsubmitted}
              <div
                class="absolute items-center p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-500 dark:text-yellow-300"
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
                  Before selecting, submit your own request!
                </span>
              </div>
            {/if}
            <!-- alert -->
            {#if showAlertOnSelectingSelf}
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
                  Don't be a narcist! Choose someone else this time!
                </span>
              </div>
            {/if}
            <ul role="list" class="divide-y divide-gray-100 mt-5">
              {#each messages as message (message.id)}
                <li
                  on:click={select(message)}
                  class="flex justify-between gap-x-3 px-4 py-5 hover:bg-gray-600 cursor-pointer"
                >
                  <div class="flex min-w-0 gap-x-4">
                    <div class="flex min-w-10 items-center">
                      <img
                        class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200"
                        src={message.author?.avatar}
                        alt=""
                      />
                    </div>
                    <div class="min-w-0 flex-auto">
                      <p class="text-sm font-semibold leading-6 text-white">
                        {parseEventContent(message).parsedContent.word1}
                        {parseEventContent(message).parsedContent.word2}
                        {parseEventContent(message).parsedContent.word3}
                        {parseEventContent(message).parsedContent.word4}
                      </p>
                      <p class="mt-1 truncate text-xs leading-5 text-gray-500">
                        {message.author?.name}
                      </p>
                    </div>
                  </div>
                  <div class="shrink-0 sm:flex sm:flex-col sm:items-end">
                    <div class="text-sm leading-6 text-gray-200">
                      {parseEventContent(message).parsedContent.location}
                    </div>
                    <div class="text-sm leading-6 text-gray-200">
                      @ {parseEventContent(message).parsedContent.timeFrom} - {parseEventContent(
                        message
                      ).parsedContent.timeTo}
                    </div>
                    <!-- <small class="text-xs leading-6 text-gray-400">
                      added {new Date(message.created_at * 1000).toLocaleTimeString([], {timeStyle: 'short'}) }
                    </small> -->
                    <small class="text-xs leading-6 text-gray-400">
                      💵 {parseEventContent(message).parsedContent.minPrice} - {parseEventContent(
                        message
                      ).parsedContent.maxPrice}
                    </small>
                    <!-- <p class="mt-1 text-xs leading-5 text-gray-500">Last seen <time datetime="2023-01-23T13:23Z">3h ago</time></p> -->
                  </div>
                </li>
              {/each}
              {#if selectedAuthor.length > 0 && messages.length < 4}
                <li class="flex justify-between gap-x-3 px-4 py-5">
                  <div class="place-content-center min-w-0 gap-x-4">
                    <span class="text-gray-400"
                      >Please wait<span class="text-gray-400 animate-ping"
                        >...</span
                      > we need 4 people to create a group chat ⏳</span
                    >
                  </div>
                </li>
              {/if}
            </ul>
          </dl>

          <div>
            {#if selectedAuthor.length > 0 && messages.length > 3 && !chatOpen}
              <button
                on:click={openOrJoinChat}
                type="button"
                class="mt-5 float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 hover:outline-2 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
              >
                Chat 💬
              </button>
            {/if}
          </div>
        {:catch error}
          <p>Error loading data: {error.message}</p>
          <!-- Error handling -->
        {/await}
      </div>
    </div>
  </div>
</main>
