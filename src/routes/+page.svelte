<script>
  import { onMount } from "svelte";

  import { browser } from "$app/environment";
  import Modal from "../lib/Modal.svelte";
  import Login from "$lib/Login.svelte";
  import Slider from "../lib/Slider.svelte";
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import NDK, {
    NDKEvent,
    NDKPrivateKeySigner,
    NDKSubscription,
  } from "@nostr-dev-kit/ndk";
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
  import Inspiration from "$lib/Inspiration.svelte";
  import InspirationModal from "$lib/InspirationModal.svelte";
  import Tooltip from "$lib/Tooltip.svelte";
  import SomeoneSelectedMeAlert from "$lib/alerts/SomeoneSelectedMeAlert.svelte";

  const KIND_0_FILTER = { kinds: [0] };
  const SUBSCRIPTION_FILTER = {
    kinds: [1, 7],
    since: getBODTimestamp(),
    until: getEODTimestamp(),
  };
  const KIND_40_FILTER = { kinds: [40] };

  let ndk;
  let showModal = false;
  let showInspirationModal = false;

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

  let showYouGotSelected = false;
  let myFollowEvent;

  let isImageCartoon = true;

  let eventsInGroup = new Set(); // Store IDs of messages with positive reactions

  const toggleMainImage = () => {
    isImageCartoon = !isImageCartoon;
  };

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
      console.log("Registration error. Try again");
      return;
    }

    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });

    // (await new NDKPrivateKeySigner().user()).pubkey
    pubkey = (await signer.user()).pubkey;

    ndk
      .connect()
      .then(() => {
        setProfileData(ndk, name, city, avatar).then(() => {
          getUserProfile(ndk, pubkey).then((_) => {
            if (isMessageValid && name.length > 0) {
              handleSubmit();
            }
          });
        });
      })
      .then(() => initMessages());
  }

  async function getUserProfile(ndk, pubkey) {
    const user = ndk.getUser({
      pubkey,
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
    await metadataEvent.sign().then((signature) => metadataEvent.publish());
    // setTimeout(async () => {
    //   await metadataEvent.publish();
    // }, 1000);
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
    const fetchSelectedFilter = {
      kinds: [1],
      authors: [pubkey],
      since: getBODTimestamp(),
      until: getEODTimestamp(),
    };
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
    return event.kind === 1 && !event.tagValue("alt") && !event.tagValue("p");
  }

  function isReplyNote(event) {
    return event instanceof NDKEvent && event.tagValue("alt") === "reply";
  }

  async function initMessages() {
    subscription = ndk.subscribe([SUBSCRIPTION_FILTER, KIND_0_FILTER], {
      closeOnEose: false,
    });
    subscription.on("event", async (event) => {
      const eventCity = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
      };

      if (isRootNote(event) && isTheSameCity(city, eventCity)) {
        addMessage(event);
      }

      await fetchMyFollower(event);
    });

    ndk.fetchEvents([SUBSCRIPTION_FILTER]).then((events) => {
      for (const event of events) {
        const eventCity = {
          cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
          cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
        };

        if (isRootNote(event) && isTheSameCity(city, eventCity)) {
          addMessage(event);
        }
        // TODO: handle reactions
        if (event.kind === 7) {
          console.log("reaction: ", event);
          if (event.tags.find((t) => t[1] === pubkey)) {
            console.log("reaction to my note: ", event);
            const targetEventPubkey = event.pubkey;

            if (event.content === "+") {
              console.log("liked my note: ", event);
              eventsInGroup.add(pubkey);
              eventsInGroup.add(targetEventPubkey);
              eventsInGroup = eventsInGroup;
            } else if (event.content === "-") {
              console.log("disliked my note: ", event);
            }
          }
        }
      }
    });
  }

  async function fetchMyFollower(event) {
    if (
      isReplyNote(event) &&
      event.tags.find((t) => t[0] === "p")?.[1] === pubkey
    ) {
      // Check if we're already in a group with this person
      const senderPubkey = event.pubkey;
      if (eventsInGroup.has(senderPubkey)) {
        console.log("Already in group with:", senderPubkey);
        return; // Skip showing the alert
      }

      await ndk
        .fetchEvents({
          kinds: [1],
          authors: [event.pubkey],
          since: getBODTimestamp(),
          until: getEODTimestamp(),
        })
        .then((events) => {
          events.forEach((e) => {
            if (isRootNote(e)) {
              getUserProfile(ndk, e.pubkey).then((profile) => {
                myFollowEvent = {
                  ...e,
                  author: {
                    name: profile?.name || "",
                    avatar: profile?.avatar || "",
                  },
                };
                showYouGotSelected = true;
              });
              return;
            }
          });
        });
    }
  }

  function isTheSameCity(city1, city2) {
    if (!city1 || !city2) return false;
    return (
      city1.cityName === city2.cityName &&
      city1.cityCountry === city2.cityCountry
    );
  }

  async function initConnectedMessages() {
    ndk
      .fetchEvents({
        kinds: [1],
        authors: [pubkey, selectedAuthor], // todo: here fetch also child
        since: getBODTimestamp(),
        until: getEODTimestamp(),
      })
      .then((notes) => notes.forEach((e) => addMessage(e)));

    subscription = ndk.subscribe([SUBSCRIPTION_FILTER, KIND_0_FILTER], {
      closeOnEose: false,
    });

    subscription.on("event", async (event) => {
      const eventCity = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
      };

      await fetchMyFollower(event);

      if (selectedAuthor.length === 0 && isTheSameCity(city, eventCity)) {
        console.log("SUB all from same city: ", event);
        await addMessage(event);
      } else {
        await fetchNestedSelect(selectedAuthor);
      }

      // TODO: handle reactions
      if (event.kind === 7) {
        console.log("reaction: ", event);
        if (event.tags.find((t) => t[1] === pubkey)) {
          console.log("reaction to my note: ", event);
          const targetEventPubkey = event.pubkey;
          if (event.content === "+") {
            console.log("liked my note: ", event);
            eventsInGroup.add(pubkey);
            eventsInGroup.add(targetEventPubkey);
            eventsInGroup = eventsInGroup;

            console.log("eventsInGroup: ", eventsInGroup);
          } else if (event.content === "-") {
            console.log("disliked my note: ", event);
          }
        }
      }
    });
  }

  async function fetchNestedSelect(key) {
    const nested = await ndk.fetchEvents({
      kinds: [1],
      authors: [key],
      since: getBODTimestamp(),
      until: getEODTimestamp(),
    });
    const childEvent = [...nested].filter((event) => isReplyNote(event))[0];
    if (childEvent) {
      const childEventKey = childEvent.tagValue("p");
      console.log("child found: ", childEventKey);
      ndk
        .fetchEvents({
          kinds: [1],
          authors: [childEventKey],
          since: getBODTimestamp(),
          until: getEODTimestamp(),
        })
        .then((e) => {
          console.log("FETCHED NESTED found: ", e);
          const rootEvent = Array.from(e).filter((m) => isRootNote(m))[0];
          if (rootEvent) {
            console.log("rootEvent found: ", rootEvent);
            addMessage(rootEvent);
          }
          const replyEvent = Array.from(e).filter((m) => isReplyNote(m))[0];
          if (replyEvent) {
            console.log("replyEvent found: ", replyEvent);
            fetchNestedSelect(replyEvent);
          }
        });
    }
  }

  async function addMessage(event) {
    if (!event) return;
    const eventPubkey = event.pubkey;

    const idExists = messages.some((m) => m.id === event.id);
    const pubkeyExists = messages.some((m) => m.pubkey === eventPubkey);

    const eventCity = {
      cityName: event.tags.find((t) => t[0] === "city")?.[1] || "",
      cityCountry: event.tags.find((t) => t[0] === "city")?.[2] || "",
    };

    if (!idExists && !pubkeyExists) {
      messages = [{ ...event, author: null }, ...messages].sort(
        (a, b) => b.created_at - a.created_at,
      );
      messages.forEach((m) => {
        fetchUserProfile(m.pubkey);
      });
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
    });
  }

  function validateMessagesWithProfile(eventPubkey, profile) {
    messages = messages.map((msg) =>
      msg.pubkey === eventPubkey ? { ...msg, author: profile } : msg,
    );
  }

  function isLoadingComplete() {
    return [...userProfiles].map((e) => e[1]).length === messages.length;
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
    selectedAuthor = event.pubkey;
    if (selectedAuthor === pubkey) {
      showAlertOnSelectingSelf = true;
      setTimeout(() => (showAlertOnSelectingSelf = false), 2000);
      selectedAuthor = ""; // Reset selection if trying to select self
      return;
    }
    localStorage.setItem("selected", selectedAuthor);
    console.log("selecting: ", selectedAuthor);
    const ownNoteFilter = { kinds: [1], authors: [pubkey] };
    const ownEvent = messages.filter((m) => m.pubkey === pubkey)[0];
    const replyEvent = new NDKEvent(ndk);
    replyEvent.kind = 1;
    replyEvent.tags = [
      ["e", event.id],
      ["alt", "reply"],
      ["p", selectedAuthor],
    ];
    replyEvent.content = (ownEvent && ownEvent.content) || "";
    messages = [];
    replyEvent.publish().then(() => {
      subscription.stop();
      userProfiles.clear();
      initConnectedMessages();
    });
  }

  // TODO why is it calling so many times??
  function parseEventContent(event) {
    // Find tags by name
    const getTag = (name) => {
      const tag = event.tags.find((t) => t[0] === name);
      return tag ? tag[1] : "";
    };

    return {
      ...event,
      parsedContent: {
        word1: getTag("topic1"),
        word2: getTag("topic2"),
        word3: getTag("topic3"),
        word4: getTag("topic4"),
        timeFrom: getTag("timeFrom"),
        timeTo: getTag("timeTo"),
        location: getTag("location"),
        city: getTag("city"),
        minPrice: getTag("priceFrom"),
        maxPrice: getTag("priceTo"),
      },
    };
  }

  function parseInputWord(word) {
    let parsedWord = word.trim();
    const cut = parsedWord.includes(" ") ? parsedWord.indexOf(" ") : 20;
    return parsedWord.substring(0, cut);
  }

  function onChangeWord1() {
    const word = parseInputWord(inputWord1);
    message.topic1 = word;
    validateMessage();
  }

  function onChangeWord2() {
    const word = parseInputWord(inputWord2);
    message.topic2 = word;
    validateMessage();
  }

  function onChangeWord3() {
    const word = parseInputWord(inputWord3);
    message.topic3 = word;
    validateMessage();
  }

  function onChangeWord4() {
    const word = parseInputWord(inputWord4);
    message.topic4 = word;
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
      message.topic1?.trim().length > 0 &&
      message.topic2?.trim().length > 0 &&
      message.topic3?.trim().length > 0 &&
      message.topic4?.trim().length > 0 &&
      message.location?.trim().length > 0;
  }

  async function handleSubmit() {
    if (submitted) {
      showAlertOnAlreadySubmitted = true;
      setTimeout(() => (showAlertOnAlreadySubmitted = false), 1500);
      return;
    }

    let loading = true;
    message.priceFrom = minValue.toString();
    message.priceTo = maxValue.toString();
    message.timeFrom = timeFrom;
    message.timeTo = timeTo;
    message.cityName = city.cityName;
    message.cityCountry = city.cityCountry;

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

    const content = `${message.cityName},${message.cityCountry},${message.location},${message.timeFrom},${message.timeTo},${message.topic1},${message.topic2},${message.topic3},${message.topic4}`;
    ndkEvent.content = content;

    // Add tags
    ndkEvent.tags = [
      ["topic1", message.topic1],
      ["topic2", message.topic2],
      ["topic3", message.topic3],
      ["topic4", message.topic4],
      ["timeFrom", message.timeFrom],
      ["timeTo", message.timeTo],
      ["location", message.location],
      ["city", message.cityName, message.cityCountry],
      ["priceFrom", message.priceFrom],
      ["priceTo", message.priceTo],
    ];

    await ndkEvent.publish();
    return ndkEvent;
  }

  async function openOrJoinChat() {
    if (!channelId) {
      const allChannels = await ndk.fetchEvents(KIND_40_FILTER);
      const channelEvent = [...allChannels].filter((event) =>
        userProfiles.has(event.pubkey),
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
              userProfiles.has(event.pubkey),
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

  function openInspirationModal() {
    showInspirationModal = true;
  }

  function closeModal() {
    showInspirationModal = false;
  }
</script>

<main>
  {#if showModal}
    <Modal bind:showModal>
      <Login on:register={handleRegister} on:login={handleLogin} />
    </Modal>
  {/if}
  {#if showInspirationModal}
    <InspirationModal bind:showInspirationModal>
      <Inspiration onClose={closeModal} />
    </InspirationModal>
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
            <!-- <button on:click={openInspirationModal}> -->
            <img
              src="/logo_wtr.png"
              alt="logo"
              class="h-20 transition-transform duration-900 ease-in-out transform hover:scale-150"
            />
            <!-- </button> -->
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
                Quick meet with friendly people around?
              </h2>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                What do you want to talk about today? <br />(only 4 words)
              </p>
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
              <p class="mt-4 text-lg leading-8 text-gray-300">When?</p>
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
                Your food budget:
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
              <Chat {ndk} username={name} {channelId} signerKey={pubkey}></Chat>
            </div>
          </div>
        {/if}

        <!-- alert -->
        {#if showAlertOnSubmittingSuccess}
          <OnSubmittingSuccessAlert
            on:showAlert={() => (showAlertOnSubmittingSuccess = false)}
          />
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
            {#if showYouGotSelected}
              <div class="text-lg font-semibold leading-6 text-white">
                Someone selected you!
              </div>
              <SomeoneSelectedMeAlert
                eventData={myFollowEvent}
                on:reaction={async (event) => {
                  const { reactionData } = event.detail;
                  console.log("Received reaction event:", reactionData);
                  try {
                    const reactionEvent = new NDKEvent(ndk);
                    reactionEvent.kind = reactionData.kind;
                    reactionEvent.content = reactionData.content;
                    reactionEvent.tags = reactionData.tags;
                    await reactionEvent.sign();
                    await reactionEvent.publish();

                    // Add both users to the group if it's a positive reaction
                    if (reactionData.content === "+") {
                      const followerPubkey = myFollowEvent.pubkey;
                      eventsInGroup.add(pubkey); // Add myself
                      eventsInGroup.add(followerPubkey); // Add the follower
                      eventsInGroup = eventsInGroup; // Trigger Svelte reactivity
                      console.log("Added to group:", pubkey, followerPubkey);
                    }

                    console.log("Reaction published successfully");
                  } catch (error) {
                    console.error("Error publishing reaction:", error);
                  } finally {
                    showYouGotSelected = false;
                  }
                }}
              />
            {/if}
            <ul role="list" class="divide-y divide-gray-100 mt-5">
              {#each messages as message (message.id)}
                <li
                  on:click={(event) => select(message)}
                  class="flex justify-between gap-x-3 px-4 py-5 hover:bg-gray-600 cursor-pointer"
                >
                  <div class="flex min-w-0 gap-x-7">
                    <div class="flex min-w-10 items-center relative">
                      {#if !message.author || !message.author.avatar}
                        <div class="avatarLoader">Loading...</div>
                      {:else}
                        <div class="relative">
                          <img
                            class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200"
                            src={message.author && message.author?.avatar}
                            alt=""
                          />
                          {#if eventsInGroup.has(message.pubkey)}
                            <div class="absolute -bottom-1 -right-1">
                              <span class="text-xs">✅</span>
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <div class="grid grid-cols-1 gap-0 content-center">
                      <p
                        class="text-sm truncate font-semibold text-white flex justify-start"
                      >
                        {parseEventContent(message).parsedContent.word1}
                        {parseEventContent(message).parsedContent.word2}
                        {parseEventContent(message).parsedContent.word3}
                        {parseEventContent(message).parsedContent.word4}
                      </p>
                      {#if !message.author || !message.author.name}
                        <p
                          class="mt-1 truncate text-xs flex justify-start text-gray-500"
                        >
                          ???
                        </p>
                      {:else}
                        <p
                          class="mt-1 truncate text-xs flex justify-start text-gray-500"
                        >
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
                        message,
                      ).parsedContent.timeTo}
                    </div>
                    <!-- <small class="text-xs leading-6 text-gray-400">
                      added {new Date(message.created_at * 1000).toLocaleTimeString([], {timeStyle: 'short'}) }
                    </small> -->

                    <small class="text-xs leading-6 text-gray-400 truncate">
                      💵 {parseEventContent(message).parsedContent.minPrice} - {parseEventContent(
                        message,
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
                  <Tooltip text="Get inspired!" position="center">
                    <button on:click={openInspirationModal}>
                      <div
                        class="inspire-img"
                        on:mouseenter={toggleMainImage}
                        on:mouseleave={toggleMainImage}
                      >
                        <div
                          class={`transition-opacity duration-1000 ease-in-out ${isImageCartoon ? "opacity-0" : "opacity-100"}`}
                        >
                          <img
                            alt="front-img"
                            src="/images/photos/hook_front.jpg"
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div
                          class={`transition-opacity duration-1000 ease-in-out ${isImageCartoon ? "opacity-100" : "opacity-0"}`}
                        >
                          <img
                            alt="cartoon-img"
                            src="/images/photos/hook_front_cartoon.png"
                            class="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </button>
                  </Tooltip>
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

  .inspire-img {
    display: grid;
    grid-template-columns: 1fr;
    overflow: hidden;
  }

  .inspire-img div {
    grid-row-start: 1;
    grid-column-start: 1;
    position: relative;
  }
</style>
