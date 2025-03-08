<script lang="ts">
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
    type NDKFilter,
    type NDKUserProfile,
    type NDKUser,
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
  import SomeoneRejectedMeAlert from "$lib/alerts/SomeoneRejectedMeAlert.svelte";
  import type {
    City,
    Author,
    ParsedContent,
    MessageContent,
    Message,
    CachedReaction,
  } from "../types";
  import moment from "moment-timezone";

  function getBODTimestamp(tz: string): number {
    const bod = moment.tz(tz).startOf("day");
    return parseInt(bod.format("X"));
  }

  function getEODTimestamp(tz: string): number {
    const bod = moment.tz(tz).endOf("day");
    return parseInt(bod.format("X"));
  }

  const KIND_0_FILTER: NDKFilter = { kinds: [0] };
  const KIND_40_FILTER: NDKFilter = { kinds: [40] };

  const AVATAR_BASE_URL = "https://hook.cafe/files/avatars";

  let ndk: NDK;
  let showModal = false;
  let showInspirationModal = false;

  let isAuthenticated = false;
  let name = "";
  let city: City | null = null;
  let avatar = "";
  let privKey = "";
  let pubkey = "";
  let signer: NDKPrivateKeySigner;
  let signerProfile: NDKUserProfile;
  let subscription: NDKSubscription;
  let messages: Message[] = [];
  let userProfiles = new Map<string, Author>();
  let submitted: NDKEvent | null = null;
  let selectedAuthor = "";
  let channelId: string | null = null;
  let chatOpen: boolean | null = null;
  let loadingComplete: boolean;

  // price slider
  let minValue: number;
  let maxValue: number;

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
  let message: MessageContent = {};

  let showAlertOnSelectUnsubmitted = false;
  let showAlertOnSubmittingInvalid = false;
  let showAlertOnAlreadySubmitted = false;
  let showAlertOnSubmittingSuccess = false;
  let showAlertOnSelectingSelf = false;
  let showAlertOnPageReload = false;

  let showYouGotSelected = false;
  let myFollowEvent: NDKEvent | null = null;
  let showRejectionAlert = false;
  let rejectionEvent: NDKEvent | null = null;

  let isImageCartoon = true;

  let eventsInGroup = new Set<string>(); // Store IDs of messages with positive reactions
  let rejectedEvents = new Set<string>(); // Store IDs of messages with negative reactions

  const toggleMainImage = (): void => {
    isImageCartoon = !isImageCartoon;
  };

  function getAvatarUrl(avatarPath: string): string {
    if (!avatarPath) return "";
    const fileName = avatarPath.split("/").pop(); // Get filename from path
    return `${AVATAR_BASE_URL}/${fileName}`;
  }

  async function handleRegister(event: CustomEvent): Promise<void> {
    name = event.detail.name;
    city = event.detail.city;
    avatar = event.detail.avatar;
    signer = event.detail.signer;

    if (signer) {
      isAuthenticated = true;
      showModal = false;
      privKey = signer.privateKey || "";
    } else {
      console.log("Registration error. Try again");
      return;
    }

    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });

    pubkey = (await signer.user()).pubkey;

    await ndk
      .connect()
      .then(() => console.log("Connected to NDK successfully"));
    await setProfileData(ndk, name, city, avatar);

    if (isMessageValid && name.length > 0) {
      setTimeout(async () => {
        await handleSubmit();
      }, 200);
    }

    await initMessages();
  }

  async function getUserProfile(
    ndk: NDK,
    pubkey: string,
  ): Promise<NDKUserProfile> {
    const user = ndk.getUser({
      pubkey,
    });

    await user.fetchProfile();
    return user.profile as NDKUserProfile;
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
      about: city ? `${city.cityName},${city.cityCountry},${city.tz}` : "",
      image: avatar,
    });
    metadataEvent.content = content;
    await metadataEvent.sign();
    try {
      setTimeout(async () => {
        await metadataEvent.publish();
      }, 200);
    } catch (error) {
      setTimeout(async () => {
        await metadataEvent.publish();
      }, 1000);
    }
  }

  function getCityFromProfile(profile: NDKUserProfile): City | null {
    if (!profile.about) return null;
    const [cityName, cityCountry, tz] = profile.about.split(",");
    if (!cityName || !cityCountry || !tz) {
      console.log("Missing city data parts");
      return null;
    }
    return { cityName, cityCountry, tz };
  }

  async function handleLogin(event: CustomEvent): Promise<void> {
    const rawPrivKey = event.detail.privKey;
    if (!rawPrivKey) return;

    if (typeof rawPrivKey === "object") {
      // If it's a Uint8Array, use it directly
      if (rawPrivKey instanceof Uint8Array) {
        signer = new NDKPrivateKeySigner(rawPrivKey);
        privKey = Array.from(rawPrivKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } else {
        console.error("Invalid private key format");
        return;
      }
    } else if (typeof rawPrivKey === "string") {
      // If it's a hex string, convert to Uint8Array
      try {
        const keyArray = new Uint8Array(
          rawPrivKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
        );
        signer = new NDKPrivateKeySigner(keyArray);
        privKey = rawPrivKey;
      } catch (e) {
        console.error("Error converting private key:", e);
        return;
      }
    } else {
      console.error("Invalid private key type");
      return;
    }

    ndk = new NDK({
      explicitRelayUrls: [env.PUBLIC_RELAY_URL],
      signer: signer,
    });
    await ndk.connect();
    isAuthenticated = true;
    showModal = false;

    pubkey = (await signer.user()).pubkey;
    const profile = await getUserProfile(ndk, pubkey);
    signerProfile = profile;
    name = profile?.name || "";
    city = getCityFromProfile(profile);
    avatar = profile?.image || "";

    await loadOwnEvents();
    if (madeDecision()) {
      await initConnectedMessages();
    } else {
      await initMessages();
    }
  }

  async function loadOwnEvents(): Promise<void> {
    const fetchSelectedFilter: NDKFilter = {
      kinds: [1],
      authors: [pubkey],
      since: getBODTimestamp(city?.tz || ""),
      until: getEODTimestamp(city?.tz || ""),
    };
    const submittedEvents = await ndk.fetchEvents(fetchSelectedFilter);
    submittedEvents.forEach((e: NDKEvent) => {
      if (isRootNote(e)) {
        submitted = e;
      } else if (isReplyNote(e) && !rejectedEvents.has(e.tagValue("p") || "")) {
        selectedAuthor = e.tagValue("p") || "";
        localStorage.setItem("selected", selectedAuthor);
      }
    });
  }

  onMount(async () => {
    let preloadKey: string | undefined;
    if ($page?.state?.privKey && typeof $page.state.privKey === "string") {
      preloadKey = $page.state.privKey;
    } else {
      return;
    }

    if (!preloadKey) {
      return;
    }

    privKey = preloadKey;

    if (privKey) {
      signer = new NDKPrivateKeySigner(privKey);
      isAuthenticated = true;

      rejectedEvents =
        new Set(
          JSON.parse(
            localStorage.getItem("rejectedEvents") || '{"rejectedEvents": []}',
          )?.rejectedEvents,
        ) || [];

      ndk = new NDK({
        explicitRelayUrls: [env.PUBLIC_RELAY_URL],
        signer: signer,
      });
      await ndk.connect();

      pubkey = (await signer.user()).pubkey;
      const profile = await getUserProfile(ndk, pubkey);
      signerProfile = profile;
      name = profile?.name || "";
      city = getCityFromProfile(profile);
      avatar = profile?.image || "";

      await loadOwnEvents();
      if (madeDecision()) {
        await initConnectedMessages();
      } else {
        await initMessages();
      }
    }
  });

  function madeDecision(): boolean {
    return selectedAuthor.length > 0;
  }

  function isRootNote(event: NDKEvent): boolean {
    return event.kind === 1 && !event.hasTag("alt") && !event.hasTag("p");
  }

  function isReplyNote(event: NDKEvent): boolean {
    return event instanceof NDKEvent && event.tagValue("alt") === "reply";
  }

  async function initMessages(): Promise<void> {
    subscription = ndk.subscribe([
      {
        kinds: [1, 7],
        since: getBODTimestamp(city?.tz || ""),
        until: getEODTimestamp(city?.tz || ""),
      },
      KIND_0_FILTER,
    ]);
    subscription.on("event", async (event: NDKEvent) => {
      const eventCity: City = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
        tz: event.tags?.find((t) => t[0] === "city")?.[3] || "",
      };

      // if (isTheSameCity(city, eventCity) && isRootNote(event)) {
      //   await addMessage(event);
      // }

      if (
        isTheSameCity(city, eventCity) &&
        isRootNote(event) &&
        !madeDecision()
      ) {
        await addMessage(event);
      }
      await fetchMyFollower(event);
      if (submitted != null) {
        await handleReactions(event);
      }
    });

    await fetchMessages();
  }

  async function fetchMessages(): Promise<void> {
    const events = await ndk.fetchEvents([
      {
        kinds: [1, 7],
        since: getBODTimestamp(city?.tz || ""),
        until: getEODTimestamp(city?.tz || ""),
      },
    ]);
    for (const event of events) {
      const eventCity: City = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
        tz: event.tags?.find((t) => t[0] === "city")?.[3] || "",
      };

      if (
        isRootNote(event) &&
        isTheSameCity(city, eventCity) &&
        !rejectedEvents.has(event.pubkey)
      ) {
        addMessage(event);
      }

      // await handleReactions(event);
    }
  }

  async function fetchMyFollower(event: NDKEvent): Promise<void> {
    if (
      isReplyNote(event) &&
      event.tags.find((t) => t[0] === "p" && t[1] === pubkey)
    ) {
      await ndk
        .fetchEvents({
          kinds: [1],
          authors: [event.pubkey],
          since: getBODTimestamp(city?.tz || ""),
          until: getEODTimestamp(city?.tz || ""),
        })
        .then((events) => {
          events.forEach((e) => {
            if (isRootNote(e)) {
              addMessage(e);
              getUserProfile(ndk, e.pubkey).then((profile) => {
                if (profile) {
                  myFollowEvent = {
                    ...e,
                    author: {
                      name: profile.name || "",
                      avatar: profile.picture || "",
                    },
                  } as unknown as NDKEvent;
                  if (
                    !eventsInGroup.has(event.pubkey) &&
                    !rejectedEvents.has(event.pubkey)
                  ) {
                    showYouGotSelected = true;
                  }
                }
              });
              return;
            }
          });
        });
    }
  }

  function isTheSameCity(city1: City | null, city2: City | null): boolean {
    if (!city1 || !city2) return false;
    return (
      city1.cityName === city2.cityName &&
      city1.cityCountry === city2.cityCountry
    );
  }

  async function initConnectedMessages(): Promise<void> {
    const notes = await ndk.fetchEvents({
      kinds: [1],
      authors: [pubkey, selectedAuthor],
      since: getBODTimestamp(city?.tz || ""),
      until: getEODTimestamp(city?.tz || ""),
    });
    Array.from(notes)
      .filter((e) => isRootNote(e))
      .forEach(async (e) => await addMessage(e));

    subscription = ndk.subscribe([
      {
        kinds: [1, 7],
        since: getBODTimestamp(city?.tz || ""),
        until: getEODTimestamp(city?.tz || ""),
      },
      KIND_0_FILTER,
    ]);

    subscription.on("event", async (event: NDKEvent) => {
      const eventCity: City = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
        tz: event.tags?.find((t) => t[0] === "city")?.[3] || "",
      };

      if (isRootNote(event) && event.pubkey === pubkey) {
        await addMessage(event);
      } else if (
        selectedAuthor.length === 0 &&
        isTheSameCity(city, eventCity)
      ) {
        // adding all events from the same city
        await addMessage(event);
      } else {
        await fetchNestedSelect(selectedAuthor);
      }

      await fetchMyFollower(event);
      if (submitted != null) {
        await handleReactions(event);
      }
    });
  }

  async function fetchNestedSelect(key: string): Promise<void> {
    const nested = await ndk.fetchEvents({
      kinds: [1],
      authors: [key],
      since: getBODTimestamp(city?.tz || ""),
      until: getEODTimestamp(city?.tz || ""),
    });
    const childEvent = [...nested].filter((event) => isReplyNote(event))[0];
    if (childEvent) {
      const childEventKey = childEvent.tagValue("p");
      if (childEventKey) {
        ndk
          .fetchEvents({
            kinds: [1],
            authors: [childEventKey],
            since: getBODTimestamp(city?.tz || ""),
            until: getEODTimestamp(city?.tz || ""),
          })
          .then((e) => {
            const rootEvent = Array.from(e).filter((m) => isRootNote(m))[0];
            if (rootEvent) {
              addMessage(rootEvent);
            }
            const replyEvent = Array.from(e).filter((m) => isReplyNote(m))[0];
            if (replyEvent) {
              fetchNestedSelect(replyEvent.id);
            }
          });
      }
    }
  }

  async function addMessage(event: NDKEvent): Promise<void> {
    if (!event) return;

    const eventPubkey = event.pubkey;
    const idExists = messages.some((m) => m.event.id === event.id);
    const pubkeyExists = messages.some((m) => m.event.pubkey === eventPubkey);

    // const eventCity: City = {
    //   cityName: event.tags.find((t) => t[0] === "city")?.[1] || "",
    //   cityCountry: event.tags.find((t) => t[0] === "city")?.[2] || "",
    // };

    if (!idExists && !pubkeyExists) {
      messages = [{ event: event, author: null } as Message, ...messages].sort(
        (a, b) => (b.event.created_at ?? 0) - (a.event.created_at ?? 0),
      );

      messages.forEach(async (m) => {
        await fetchUserProfile(m.event.pubkey);
      });
    }
  }

  async function fetchUserProfile(eventPubkey: string): Promise<void> {
    if (userProfiles.has(eventPubkey)) return;
    const user = ndk.getUser({ pubkey: eventPubkey });
    await user.fetchProfile();
    const profile = user.profile;
    if (profile) {
      userProfiles.set(eventPubkey, profile as unknown as Author);
      validateMessagesWithProfile(eventPubkey, profile);
      loadingComplete = isLoadingComplete();
    }
  }

  function validateMessagesWithProfile(
    eventPubkey: string,
    profile: NDKUserProfile,
  ): void {
    messages = messages.map((msg) =>
      msg.event.pubkey === eventPubkey
        ? {
            ...msg,
            author: profile,
          }
        : msg,
    );
  }

  function isLoadingComplete(): boolean {
    return [...userProfiles].map((e) => e[1]).length === messages.length;
  }

  async function select(event: NDKEvent): Promise<void> {
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
      selectedAuthor = "";
      return;
    }
    localStorage.setItem("selected", selectedAuthor);
    const ownEvent = messages.filter((m) => m.event.pubkey === pubkey)[0];
    const replyEvent = new NDKEvent(ndk);
    replyEvent.kind = 1;
    replyEvent.tags = [
      ["e", event.id],
      ["alt", "reply"],
      ["p", selectedAuthor],
    ];
    replyEvent.content = ownEvent?.event.content || "";
    setTimeout(async () => {
      await replyEvent.sign();
      await replyEvent.publish();
      messages = [];
      userProfiles.clear();
      await initConnectedMessages();
    }, 300);
  }

  function parseEventContent(message: Message): {
    parsedContent: ParsedContent;
  } {
    const getTag = (name: string): string => {
      const tag = message.event.tags?.find((t) => t[0] === name);
      return tag ? tag[1] : "";
    };

    return {
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

  function parseInputWord(word: string): string {
    let parsedWord = word.trim();
    const cut = parsedWord.includes(" ") ? parsedWord.indexOf(" ") : 20;
    return parsedWord.substring(0, cut);
  }

  function onChangeWord1(): void {
    const word = parseInputWord(inputWord1);
    message.topic1 = word;
    validateMessage();
  }

  function onChangeWord2(): void {
    const word = parseInputWord(inputWord2);
    message.topic2 = word;
    validateMessage();
  }

  function onChangeWord3(): void {
    const word = parseInputWord(inputWord3);
    message.topic3 = word;
    validateMessage();
  }

  function onChangeWord4(): void {
    const word = parseInputWord(inputWord4);
    message.topic4 = word;
    validateMessage();
  }

  function onChangeLocation(): void {
    message.location = inputLocation.substring(0, 20);
    validateMessage();
  }

  function handleTimeRangeChange(event: CustomEvent): void {
    timeFrom = event.detail.startTime;
    timeTo = event.detail.endTime;
  }

  function validateMessage(): void {
    isMessageValid =
      (message.topic1?.trim().length || 0) > 0 &&
      (message.topic2?.trim().length || 0) > 0 &&
      (message.topic3?.trim().length || 0) > 0 &&
      (message.topic4?.trim().length || 0) > 0 &&
      (message.location?.trim().length || 0) > 0;
  }

  async function handleSubmit(): Promise<void> {
    if (submitted) {
      showAlertOnAlreadySubmitted = true;
      setTimeout(() => (showAlertOnAlreadySubmitted = false), 1500);
      return;
    }

    message.priceFrom = minValue.toString();
    message.priceTo = maxValue.toString();
    message.timeFrom = timeFrom;
    message.timeTo = timeTo;
    message.cityName = city?.cityName;
    message.cityCountry = city?.cityCountry;

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
      showAlertOnSubmittingSuccess = true;
      setTimeout(() => (showAlertOnSubmittingSuccess = false), 5000);
    }
  }

  async function sendMessage(message: MessageContent): Promise<NDKEvent> {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 1;

    const content = `${message.cityName},${message.cityCountry},${message.location},${message.timeFrom},${message.timeTo},${message.topic1},${message.topic2},${message.topic3},${message.topic4}`;
    ndkEvent.content = content;

    ndkEvent.tags = [
      ["topic1", message.topic1 || ""],
      ["topic2", message.topic2 || ""],
      ["topic3", message.topic3 || ""],
      ["topic4", message.topic4 || ""],
      ["timeFrom", message.timeFrom || ""],
      ["timeTo", message.timeTo || ""],
      ["location", message.location || ""],
      ["city", message.cityName || "", message.cityCountry || ""],
      ["priceFrom", message.priceFrom || ""],
      ["priceTo", message.priceTo || ""],
    ];

    console.log("Sending event...: ", ndkEvent);

    await ndkEvent.sign();
    await ndkEvent.publish();
    return ndkEvent;
  }

  async function openOrJoinChat(): Promise<void> {
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
        let channelContent: { name: string; about: string; relays: string } = {
          name: city?.cityName + "_group" || "group",
          about: "let's meet in real life!",
          relays: env.PUBLIC_RELAY_URL,
        };
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = 40;
        ndkEvent.content = JSON.stringify(channelContent);

        ndkEvent.publish().then(() => {
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

  function navigateToProfile(): void {
    const id = nip19.npubEncode(pubkey);
    goto(`/profile/${id}`, { state: { privKey } });
  }

  function openInspirationModal(): void {
    showInspirationModal = true;
  }

  function closeModal(): void {
    showInspirationModal = false;
  }

  async function handleReactions(event: NDKEvent): Promise<void> {
    if (
      event.kind === 7 &&
      event.tags.find((t) => t[0] === "ownerCity")?.[1] ===
        `${city?.cityName},${city?.cityCountry},${city?.tz}`
    ) {
      if (!city) {
        console.error("City is null, cannot handle reaction");
        return;
      }

      const reaction: CachedReaction = {
        id: event.id,
        from: event.pubkey,
        to: event.tags.find((t) => t[0] === "p")?.[1] || "",
        content: event.content,
        timestamp: event.created_at || Date.now(),
      };

      // Handle positive reactions
      if (event.content === "+") {
        if (reaction.to === pubkey) {
          // someone reacted to my message
          eventsInGroup.add(reaction.from);
          eventsInGroup.add(reaction.to);
          eventsInGroup = eventsInGroup;
        } else if (reaction.from === pubkey) {
          eventsInGroup.add(reaction.to);
          eventsInGroup = eventsInGroup;
        } else if (eventsInGroup.has(reaction.to)) {
          eventsInGroup.add(reaction.from);
          eventsInGroup = eventsInGroup;
        }
        // Handle negative reactions
      } else if (event.content === "-") {
        rejectionEvent = event;
        if (reaction.to === pubkey && !rejectedEvents.has(event.pubkey)) {
          showRejectionAlert = true;
          rejectedEvents.add(event.pubkey);
          setTimeout(() => {
            showRejectionAlert = false;
          }, 5000);
          selectedAuthor = "";
          await refreshCityMessages();
        } else if (reaction.to === selectedAuthor) {
          rejectedEvents.add(event.pubkey);
          messages = messages.filter(
            (msg) => msg.event.pubkey !== event.pubkey,
          );
        } else if (reaction.from === pubkey) {
          await ndk
            .fetchEvents({
              kinds: [7],
              authors: [reaction.to],
              since: getBODTimestamp(city?.tz || ""),
              until: getEODTimestamp(city?.tz || ""),
            })
            .then((events) => {
              const positiveEvents = Array.from(events).filter(
                (e) => e.content === "+",
              );
              positiveEvents.forEach((e) => {
                rejectedEvents.add(e.pubkey);
                rejectedEvents.add(reaction.to);

                const beforeFilterLength = messages.length;
                messages = messages.filter(
                  (msg) =>
                    msg.event.pubkey !== e.pubkey &&
                    msg.event.pubkey !== e.tagValue("p"),
                );
              });
            })
            .catch((error) => {
              console.error(error);
            });
        }
      }
      localStorage.setItem("rejectedEvents", JSON.stringify(rejectedEvents));
    }
  }

  async function refreshCityMessages(): Promise<void> {
    if (!city) {
      console.error("City is null, cannot refresh messages");
      return;
    }

    // Clear current messages and profiles
    messages = [];
    userProfiles.clear();

    // Fetch all messages from the city
    const events = await ndk.fetchEvents([
      {
        kinds: [1],
        since: getBODTimestamp(city?.tz || ""),
        until: getEODTimestamp(city?.tz || ""),
      },
    ]);

    // Add each valid message
    for (const event of events) {
      const eventCity: City = {
        cityName: event.tags?.find((t) => t[0] === "city")?.[1] || "",
        cityCountry: event.tags?.find((t) => t[0] === "city")?.[2] || "",
        tz: event.tags?.find((t) => t[0] === "city")?.[3] || "",
      };

      if (isRootNote(event) && isTheSameCity(city, eventCity)) {
        await addMessage(event);
      }
    }
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
                Let's eat together!
              </h2>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                Type below what you have in mind today
              </p>
              <p class="text-md text-gray-500">
                Only 4 words to encourage people to join
              </p>
              <div class="mt-4 flex max-w-md gap-x-4">
                <label for="word-1" class="sr-only">Word 1</label>
                <input
                  bind:value={inputWord1}
                  on:change={onChangeWord1}
                  id="word-1"
                  name="text"
                  type="text"
                  required
                  class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-2.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs sm:leading-6"
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
                  class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-2.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs sm:leading-6"
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
                  class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-2.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs sm:leading-6"
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
                  class="min-w-0 flex-auto rounded-md border-0 bg-white/5 px-2.5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs sm:leading-6"
                  placeholder="Word 4"
                />
              </div>
              <p class="mt-4 text-lg leading-8 text-gray-300">
                Where can you meet?
              </p>
              <!-- location -->
              <div class="mt-4 flex-direction max-w-md gap-x-4">
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
              <div class="mt-4 flex max-w-md gap-x-4">
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
              <p class="mt-6 text-lg leading-8 text-gray-300">
                Your food budget
              </p>
              <div class="mt-2 flex max-w-md gap-x-4">
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
                    Let's go!
                  </button>
                {:else}
                  <button
                    on:click={() => (showModal = true)}
                    type="submit"
                    class="mt-5 float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  >
                    Let's go!
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
                  try {
                    const reactionEvent = new NDKEvent(ndk);
                    reactionEvent.kind = reactionData.kind;
                    reactionEvent.content = reactionData.content;
                    reactionEvent.tags = reactionData.tags;
                    await reactionEvent.sign();
                    await reactionEvent.publish();

                    // Add both users to the group if it's a positive reaction
                    // const followerPubkey = myFollowEvent?.pubkey || null;
                    // if (followerPubkey && reactionData.content === "+") {
                    //   eventsInGroup.add(pubkey); // Add myself
                    //   eventsInGroup.add(followerPubkey); // Add the follower
                    //   eventsInGroup = eventsInGroup;
                    // }
                  } catch (error) {
                    console.error("Error publishing reaction:", error);
                  } finally {
                    showYouGotSelected = false;
                  }
                }}
              />
            {/if}
            {#if showRejectionAlert}
              <SomeoneRejectedMeAlert eventData={rejectionEvent} />
            {/if}
            <ul role="list" class="divide-y divide-gray-100 mt-5">
              {#each messages.filter((m) => !rejectedEvents.has(m.event.pubkey)) as message (message.event.id)}
                <button
                  on:click={() => select(message.event)}
                  class="flex justify-between gap-x-3 px-4 py-5 hover:bg-gray-600 cursor-pointer w-full"
                >
                  <div class="flex min-w-0 gap-x-7">
                    <div class="flex min-w-10 items-center relative">
                      {#if !message.author?.image}
                        <div class="avatarLoader">Loading...</div>
                      {:else}
                        <div class="relative">
                          <img
                            class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500 hover:bg-blue-200"
                            src={message?.author?.image || ""}
                            alt=""
                          />
                          {#if eventsInGroup.has(message.event.pubkey)}
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
                          {message.author?.name}
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
                </button>
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
            {#if selectedAuthor.length > 0 && messages.length > 3 && !chatOpen && loadingComplete}
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
