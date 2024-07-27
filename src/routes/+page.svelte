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
  let city = null;
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
    city = event.detail.city;
    avatar = event.detail.avatar;
    showModal = false;

    // TODO we can take the key from dispatched event and use here
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

    await setProfileData(ndk, name, city, avatar);

    const pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || '';
    city = profile.city || null;
    avatar = profile.avatar || '';

    // if stared adding request we will try to submit it after the registration
    if (isMessageValid) {
      await handleSubmit();
    }

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
    city = profile.city || null;
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
    name = profile.name || "";
    city = profile.city || null;

    if (selectedAuthor.length > 0) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  });

  function isRootNote(event) {
    return event.kind === 1 && !event.tags.some(tag => tag[0] === 'e');
  }

  // TODO: replace with eventIsReply
  function isReplyNote(event) {
    return event.kind === 1 && event.tags.some(tag => tag[0] === 'e');
  }

  async function initMessages() {
    console.log('initMessages')
    const profileFilter = {kinds: [0] };
    const fetchFilter = { kinds: [1] };
    subscription = ndk.subscribe([fetchFilter, profileFilter], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      const eventCity = JSON.parse(event.content).city;
      if (isRootNote(event) && isTheSameCity(city, eventCity)) {
        addMessage(event);
      }
    });
    ndk.fetchEvents([fetchFilter]).then(events => {
      for (const event of events) {
        const eventCity = JSON.parse(event.content).city;
        if (isRootNote(event) && isTheSameCity(city, eventCity)) {
          addMessage(event);
        }
      }
    })
  };

  function isTheSameCity(city1, city2) {
    return city1.cityName === city2.cityName && city1.cityCountry === city2.cityCountry
  }

  async function initConnectedMessages() {
    console.log('initConnected')
    const profileFilter = {kinds: [0] };
  
    // 1. selected and its parent
    let selectedNote;
    ndk.fetchEvents({ kinds: [1], authors: [selectedAuthor] }).then(
      notes => notes.forEach(e => {
      // selected
        if (isRootNote(e)) {
          selectedNote = e;
        // localStorage.setItem('myEvent', e);
        }


    }));

    // 2. replies to selected
    const generalFilter = { kinds: [1] };
    let selectedReplyNotes = [];
    // const repliesToSelected = await ndk.fetchEvents(generalFilter);
    // for (const note of repliesToSelected) {
    //   if (note.getMatchingTags('e', selectedAuthor) !== null) {
    //     selectedReplyNotes.push(note)
    //     }
    // }
    ndk.fetchEvents(generalFilter).then(notes => {
      for (const note of notes) {
        if (isReplyNote(note) && note.getMatchingTags('e', selectedAuthor) !== null) {
          // console.log('filtered: ', note)
          selectedReplyNotes.push(note);
        }
      }
    })
    // console.log('selectedReplyNotes: ', selectedReplyNotes )
    
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
    } );
    subscription.on("event", async (event) => {
      if (isReplyNote(event)) {
        // selected parent has to add me:
        addMessage(event);

        // I have to add the parent
        const selectedParentKey = event.tagValue('p');
        ndk.fetchEvents({ kinds: [1], authors: [selectedParentKey] })
        .then(p => p.forEach(note => {
            if (isRootNote(note)) {
              addMessage(note);
              console.log('root: ', note )
            }
          })
        )
      }
    });

    // todo: why kareem doesn't load mike
    
    const allNotes = new Set([...selectedReplyNotes, ...toMineReplyNotes]);
    
    addMessage(selectedNote);
    for (const event of allNotes) {
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
    // console.log('all ', messages)
    // console.log('adding arrived: ', event )
    if (!idExists && !pubkeyExists) {
      // console.log('arrived not exist: ', event )
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
    await validateMessagesWithProfile(pubkey, profile);
  }

  async function validateMessagesWithProfile(pubkey, profile) {
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
    messages = [];
    replyEvent.publish().then(() => {
      userProfiles.clear();
      initConnectedMessages();
      }
    );
  }

  // TODO why is it calling so many times??
  function parseEventContent(event) {
    return {
      ...event,
      parsedContent: JSON.parse(event.content),
    };
  }
  // import NostriChat from "$lib/NostriChat.svelte";

  // price slider
  import Slider from "../lib/Slider.svelte";
  import { goto } from "$app/navigation";
  let minValue;
  let maxValue;

  // prepare the note
  let inputWord1 = "";
  let inputWord2 = "";
  let inputWord3 = "";
  let inputWord4 = "";
  let inputLocation = "";
  /**
   * @type {boolean}
   */
  let isMessageValid;
  let message = {};

  function onChangeWord1() {
    message.word1 = inputWord1;
    validateMessage();
  }

  function onChangeWord2() {
    message.word2 = inputWord2;
    validateMessage();
  }

  function onChangeWord3() {
    message.word3 = inputWord3;
    validateMessage();
  }

  function onChangeWord4() {
    message.word4 = inputWord4;
    validateMessage();
  }

  function onChangeLocation() {
    message.location = inputLocation;
    validateMessage();
  }

  // time picker
  import TimeRangePicker from "../lib/TimeRangePicker.svelte";
  import NostriChat from "$lib/NostriChat.svelte";
  let timeFrom = "12:00";
  let timeTo = "13:00";

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
    const currentUserKey = (await signer.user()).pubkey;
    const alreadyAdded = messages.map(e => e.pubkey).includes(currentUserKey);
    if (alreadyAdded) {
      alert("You can add only one request per day!"); // todo replace
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
    ndkEvent.content = JSON.stringify(message);
    ndkEvent.publish();
    return ndkEvent;
  }

</script>


<main>
  {#if showModal}
    <Modal bind:showModal>
      <Login on:register={handleRegister} on:login={handleLogin} />
    </Modal>
  {/if}
  <div class="relative isolate overflow-hidden bg-gray-900 min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
    <div class="w-full max-w-4xl py-16 sm:py-24 lg:py-32">
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
        class={submitted || !isAuthenticated ? "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-1" : "mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2"}
      >

        <!-- form -->
        {#if !submitted}
        <div class="flex flex-col place-content-center" > 
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
            <p class="mt-4 text-lg leading-8 text-gray-300">Your meal time:</p>
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
                  <div class="flex min-w-10 items-center">
                    <img class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200" src="{message.author?.avatar}" alt="">
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
                <div class=" shrink-0 sm:flex sm:flex-col sm:items-end">
                  <p class="text-sm leading-6 text-gray-200">
                    {parseEventContent(message).parsedContent.location} @ {parseEventContent(message).parsedContent.timeFrom} - {parseEventContent(message).parsedContent.timeTo}
                  </p>
                  <small class="text-xs leading-6 text-gray-400">
                    added {new Date(new Date() - new Date(message.created_at * 1000)).toLocaleTimeString([], {timeStyle: "short"}) }
                  </small>
                  <!-- <p class="mt-1 text-xs leading-5 text-gray-500">Last seen <time datetime="2023-01-23T13:23Z">3h ago</time></p> -->
                </div>
              </li>
            {/each}
          </ul>
        </dl>
        <!-- <div>
          todo
          <NostriChat />
        </div> -->
        <!-- end list -->
      </div>
    </div>
</main>

<!-- <style lang="postcss">
  :global(html) {
    background-color: theme(colors.gray.100);
  }
</style> -->
