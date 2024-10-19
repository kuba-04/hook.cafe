<script>
  import { onMount } from "svelte";

  import { browser } from '$app/environment';
  import Modal from "../lib/Modal.svelte";
  import Login from "$lib/Login.svelte";
  import Slider from "../lib/Slider.svelte";
  import { goto } from "$app/navigation";
  import { env } from '$env/dynamic/public';
  import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
  import { nip19 } from "nostr-tools";
  import TimeRangePicker from "../lib/TimeRangePicker.svelte";
  import Chat from "$lib/Chat/Chat.svelte";
  import { page } from "$app/stores";
  import OnPageLoadAlert from "$lib/alerts/OnPageLoadAlert.svelte";
  import OnSubmitInvalidAlert from "$lib/alerts/OnSubmitInvalidAlert.svelte";
  import OnAlreadySubmittedAlert from "$lib/alerts/OnAlreadySubmittedAlert.svelte";
  import OnSubmittingSuccessAlert from "$lib/alerts/OnSubmittingSuccessAlert.svelte";
  import OnSelectingSelfAlert from "$lib/alerts/OnSelectingSelfAlert.svelte";
  import OnSelectUnsubmittedAlert from "$lib/alerts/OnSelectUnsubmittedAlert.svelte";

  const PROFILE_FILTER = { kinds: [0] };
  const KIND_1_FILTER = { kinds: [1], since: getBODTimestamp(), until: getEODTimestamp() };
  const KIND_40_FILTER = { kinds: [40] };

  let ndk;
  let showModal = false;
  let isAuthenticated = false;
  let name = "";
  let city = null;
  let avatar = "";
  let privKey = null;
  let pubkey = "";
  let signer;
  let subscription;
  let messages = [];
  let userProfiles = new Map();
  let submitted = null;
  let selectedAuthor = "";
  let channelId = null;
  let chatOpen = null;
  let loadingComplete;

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
    signer = event.detail.signer;

    if (signer) {
      isAuthenticated = true;
      showModal = false;
      privKey = signer.privateKey;
    } else {
      console.log('Registration error. Try again');
      return;
    }

    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });

    // (await new NDKPrivateKeySigner().user()).pubkey
    pubkey = (await (signer.user())).pubkey;

    ndk.connect().then(() => {
      setProfileData(ndk, name, city, avatar).then(() => {
        getUserProfile(ndk, pubkey).then(_ => {
          if (isMessageValid && name.length > 0) {
            handleSubmit();
          }      
        })
      }) 
    }).then(() => initMessages());
  }

  async function getUserProfile(ndk, pubkey) {
    const user = ndk.getUser({
      pubkey
    });

    return await user.fetchProfile();
  }

  async function setProfileData(ndk, name, city, avatar) {
    const metadataEvent = new NDKEvent(ndk);
    metadataEvent.kind = 0;
    const content = JSON.stringify({
      name: name,
      city: city,
      avatar: avatar,
    });
    metadataEvent.content = content;
    await metadataEvent.sign();
    await metadataEvent.publish();
  }

  async function handleLogin(event) {
    privKey = event.detail.privKey;
    signer = new NDKPrivateKeySigner(privKey);
    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });
    await ndk.connect();
    isAuthenticated = true;
    showModal = false;

    pubkey = (await signer.user()).pubkey;
    const profile = await getUserProfile(ndk, pubkey);
    name = profile.name || "";
    city = profile.city || null;
    avatar = profile.avatar || "";

    await loadOwnEvents();
    if (madeDecision()) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  }

  async function loadOwnEvents() {
    const fetchSelectedFilter = { kinds: [1], authors: [pubkey], since: getBODTimestamp(), until: getEODTimestamp() };
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

  // this is a try to prevent refreshing without logging out
  // function handleBeforeUnload(event) {
  //   showAlertOnPageReload = true;
  //   setTimeout(() => showAlertOnPageReload = false, 4000);
  //   event.preventDefault();
  // }
  
  function getBODTimestamp() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime().toString().substring(0, 10);
  }

  function getEODTimestamp() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.getTime().toString().substring(0, 10);
  }

  onMount(async () => {
    // if (browser) {
    //   window.addEventListener('beforeunload', handleBeforeUnload);
    // }
    let preloadKey;
    if ($page && $page.state) {
      preloadKey = $page.state;
    } else {
      return;
    }
    if (Object.keys(preloadKey).length === 0) {
      return;
    } else {
      privKey = preloadKey.toString();
    }

    if (privKey) {
      signer = new NDKPrivateKeySigner(privKey);
      isAuthenticated = true;
    } else {
      isAuthenticated = false;
      showModal = true;
      return;
    }
    selectedAuthor = localStorage.getItem("selected") || "";

    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });

    try {
      await ndk.connect().then(() => console.log("connected"));
    } catch (e) {
      console.log("unable to connect to relay");
    }
    pubkey = (await signer.user()).pubkey;
    await loadOwnEvents();
    const profile = await getUserProfile(ndk, pubkey);
    avatar = profile.avatar || "";
    name = profile.name || "";
    city = profile.city || null;

    if (madeDecision()) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  });

  function madeDecision() {
    return selectedAuthor.length > 0;
  }

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
        addMessage(event).then(() => fetchUserProfile(event.pubkey));
      }
    });
    ndk.fetchEvents([KIND_1_FILTER]).then((events) => {
      for (const event of events) {
        const eventCity = JSON.parse(event.content).city;
        if (isRootNote(event) && isTheSameCity(city, eventCity)) {
          addMessage(event).then(() => fetchUserProfile(event.pubkey));
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
    ndk
      .fetchEvents({ kinds: [1], authors: [selectedAuthor], since: getBODTimestamp(), until: getEODTimestamp() })
      .then((notes) =>
        notes.forEach((e) => {
          // selected
          if (isRootNote(e)) {
            addMessage(e).then(() => fetchUserProfile(e.pubkey));
          } else {
            // and his parent:
            const selectedParentKey = e.tagValue("p");
            ndk
              .fetchEvents({ kinds: [1], authors: [selectedParentKey] })
              .then((p) =>
                p.forEach((note) => {
                  if (isRootNote(note)) {
                    addMessage(note).then(() => fetchUserProfile(note.pubkey));
                  }
                })
              );
          }
        })
      );

    // 3. replies: to mine & to selected
    ndk.fetchEvents(KIND_1_FILTER).then((notes) => {
      notes.forEach((note) => {
        if (
          isReplyNote(note) &&
          (note.getMatchingTags("e", pubkey) !== null ||
            note.getMatchingTags("e", selectedAuthor) !== null)
        ) {
          addMessage(note).then(() => fetchUserProfile(note.pubkey));
        }
      });
    });

    subscription = ndk.subscribe([KIND_1_FILTER, PROFILE_FILTER], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      if (isReplyNote(event)) {
        // selected author has to sub my note:
        addMessage(event)
          .then(() => fetchUserProfile(event.pubkey))
          .then(() => {
            // and we have to add the parent's note:
            const selectedParentKey = event.tagValue("p");
            ndk
              .fetchEvents({ kinds: [1], authors: [selectedParentKey], since: getBODTimestamp(), until: getEODTimestamp() })
              .then((p) =>
                p.forEach((note) => {
                  if (isRootNote(note)) {
                    addMessage(note).then(() => fetchUserProfile(note.pubkey));
                  }
                })
              );
          })
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
    }
  }

  async function fetchUserProfile(eventPubkey) {
    if (userProfiles.has(eventPubkey)) return;
    const user = ndk.getUser({ pubkey: eventPubkey });
    user.fetchProfile().then(() => {
      const profile = user.profile;
      
      userProfiles.set(eventPubkey, profile);
      validateMessagesWithProfile(eventPubkey, profile);
      loadingComplete = isLoadingComplete();
    })
  }

  function validateMessagesWithProfile(eventPubkey, profile) {
    messages = messages.map((msg) =>
      msg.pubkey === eventPubkey ? { ...msg, author: profile } : msg
    );
  }

  function isLoadingComplete() {
    return [...userProfiles].map(e => e[1]).length === messages.length;
  }

  async function select(event) {
    if (madeDecision()) {
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
    replyEvent.content = (ownEvent && ownEvent.content) || "";
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
        if (browser) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        console.log("creating channel..");
        let channelContent = {};
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = 40;

        channelContent.name = city.cityName + "_group";
        channelContent.about = "let's meet in real life!";
        channelContent.relays = env.PUBLIC_RELAY_URL;
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
              if (browser) {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }
          });
        });
      }
    } else {
      console.log("joining channel...");
      chatOpen = true;
      if (browser) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }

  function navigateToProfile() {
    const id = nip19.npubEncode(pubkey);
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
    class="relative isolate overflow-hidden bg-gray-900 min-h-screen flex justify-center px-4 sm:px-6 lg:px-8"
  >
    <!-- alert -->
    {#if showAlertOnPageReload}
      <OnPageLoadAlert />
    {/if}

    <div class="w-full max-w-4xl">
      <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div class="flex justify-between">
          <!-- todo: decide if the below info is helping or confusing -->
            <!-- {#if madeDecision()}
              <div class="absolute top-25 left-10 items-center">
                <p class="text-lg text-gray-300">
                  Building {city && city.cityName} group<span class="animate-ping"
                    >...</span
                  >
                </p>
              </div>
            {:else if submitted && city && city.cityName}
              <div class="absolute top-15 left-10 py-10 text-center">
                <p class="text-lg text-gray-300">
                  Who else is up for a food in {city && city.cityName}?<br class="md:hide" />
                </p>
              </div>
            {/if} -->
          <div>
            <!-- placeholder for menu / about -->
          </div>
          <div>
            <a href="/inspiration">
              <img 
                src="/logo_wtr.png" 
                alt="logo" 
                class="h-20 transition-transform duration-900 ease-in-out transform hover:scale-150" 
                />
            </a>
          </div>
          {#if isAuthenticated}
            <div class="">
              <p class="mt-4 text-lg leading-8 text-gray-300 items-end">
                <button on:click={navigateToProfile}>
                  <img
                    class="w-12 h-12 p-1 rounded-full ring-2 hover:ring-0 ring-gray-300 hover:bg-yellow-100"
                    src={avatar}
                    alt="avatar"
                  />
                </button>
              </p>
            </div>
          {:else}
            <div class="w-12 h-12">
              <!-- placeholder to keep the column for avatar -->
            </div>
          {/if}
        </div>
      </div>

      <!-- <div
        class={(submitted || !isAuthenticated) && !chatOpen
          ? "mx-auto grid max-w-2xl grid-cols-1 lg:max-w-none lg:grid-cols-1"
          : "mx-auto grid max-w-2xl grid-cols-1 gap-x-20 lg:max-w-none lg:grid-cols-2"}
      > -->
      <div
        class={submitted && !chatOpen
          ? "mx-auto grid max-w-2xl grid-cols-1 lg:max-w-none lg:grid-cols-1"
          : "mx-auto grid max-w-2xl grid-cols-1 gap-x-20 lg:max-w-none lg:grid-cols-2"}
      >
        <!-- form -->
        {#if !submitted}
          <div class="flex flex-col place-content-center my-10">
            <div class="max-w-xl lg:max-w-lg">
              <h2
                class="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Quick lunch or coffee with friendly people around you?
              </h2>
              <p class="mt-4 text-lg leading-8 text-gray-300">What do you want to talk about today? <br>(only 4 words)</p>
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
                Where can you meet?
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
                  placeholder="Street or borough"
                />
              </div>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                When?
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

              <!-- TODO: not working on mobile browsers -->
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
                <OnSubmitInvalidAlert />
              {/if}
              <!-- alert -->
              {#if showAlertOnAlreadySubmitted}
                <OnAlreadySubmittedAlert />
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
              <Chat {ndk} username={name} {channelId} signerKey={pubkey}
              ></Chat>
            </div>
          </div>
        {/if}

        <!-- alert -->
        {#if showAlertOnSubmittingSuccess}
          <OnSubmittingSuccessAlert on:showAlert={() => showAlertOnSubmittingSuccess = false} />
        {/if}

        {#await initConnectedMessages}
          <p>Loading...</p>
          <!-- Loader displayed while waiting -->
        {:then _}
          <!-- list -->
          <dl class="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-1 lg:pt-2">
            <!-- alert -->
            {#if showAlertOnSelectUnsubmitted}
              <OnSelectUnsubmittedAlert />
            {/if}
            <!-- alert -->
            {#if showAlertOnSelectingSelf}
              <OnSelectingSelfAlert />
            {/if}
            <ul role="list" class="divide-y divide-gray-100 mt-5">
              {#each messages as message (message.id)}
                <li
                  on:click={(event) => select(message)}
                  class="flex justify-between gap-x-3 px-4 py-5 hover:bg-gray-600 cursor-pointer"
                >
                    <div class="flex min-w-0 gap-x-7">
                      <div class="flex min-w-10 items-center">
                        {#if !message.author || !message.author.avatar}
                          <div class="avatarLoader">Loading...</div>
                        {:else}
                          <img
                            class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200"
                            src={message.author && message.author?.avatar}
                            alt=""
                          />
                        {/if}
                      </div>
                      <div class="grid grid-cols-1 gap-0 content-center">
                        <p class="text-sm truncate font-semibold text-white flex justify-start">
                          {parseEventContent(message).parsedContent.word1}
                          {parseEventContent(message).parsedContent.word2}
                          {parseEventContent(message).parsedContent.word3}
                          {parseEventContent(message).parsedContent.word4}
                        </p>
                        {#if !message.author || !message.author.name}
                          <p class="mt-1 truncate text-xs flex justify-start text-gray-500">???</p>
                        {:else}
                          <p class="mt-1 truncate text-xs flex justify-start text-gray-500">
                            {message.author && message.author.name}
                          </p>
                        {/if}
                      </div>
                    </div>
                  <div class="shrink-0 sm:flex sm:flex-col sm:items-end">
                    <div class="text-sm leading-6 text-gray-200 truncate">
                      {parseEventContent(message).parsedContent.location}
                    </div>
                    <div class="text-sm leading-6 text-gray-200 truncate">
                      @ {parseEventContent(message).parsedContent.timeFrom} - {parseEventContent(
                        message
                        ).parsedContent.timeTo}
                    </div>
                    <!-- <small class="text-xs leading-6 text-gray-400">
                      added {new Date(message.created_at * 1000).toLocaleTimeString([], {timeStyle: 'short'}) }
                    </small> -->
                    
                    <small class="text-xs leading-6 text-gray-400 truncate">
                      💵 {parseEventContent(message).parsedContent.minPrice} - {parseEventContent(
                        message
                        ).parsedContent.maxPrice}
                      </small>
                      <!-- <p class="mt-1 text-xs leading-5 text-gray-500">Last seen <time datetime="2023-01-23T13:23Z">3h ago</time></p> -->
                    </div>
                </li>
              {/each}
              {#if madeDecision() && messages.length < 4}
                <li class="flex justify-between gap-x-3 px-4 py-5">
                  <div class="place-content-center min-w-0 gap-x-4">
                    <span class="text-gray-400"
                      >Please wait<span class="text-gray-400 animate-ping"
                        >...</span
                      > we need 4 people to create a group chat ⏳</span
                    >
                  </div>
                </li>
              {:else if messages.length === 0}
                <div class="divide-y divide-gray-100 mt-5">
                  <img alt="front-img" src="/images/photos/hook_front.png"/>
                </div>
              {/if}
            </ul>
          </dl>

          <div>
            {#if madeDecision() && messages.length > 3 && !chatOpen && loadingComplete}
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

<style>
  /* avatar loader start */
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
  /* avatar loader end */

</style>