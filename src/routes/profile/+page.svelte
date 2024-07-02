<script>
  import { decryptKey, getUserProfile, setProfileData } from "$lib/authUtils";
  import Modal from "../../lib/Modal.svelte";
  import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
  import { onMount } from "svelte";
  import { RELAY_URL } from "$lib/Env";

  // List of avatars
  import bear from "../../lib/images/avatars/bear.png";
  import bearTeddy from "../../lib/images/avatars/bear-teddy.png";
  import birdSing from "../../lib/images/avatars/bird-sing.png";
  import bird from "../../lib/images/avatars/bird.png";
  import bird2 from "../../lib/images/avatars/bird2.png";
  import cat from "../../lib/images/avatars/cat.png";
  import crab from "../../lib/images/avatars/crab.png";
  import crocodile from "../../lib/images/avatars/crocodile.png";
  import dino from "../../lib/images/avatars/dino.png";
  import dogBig from "../../lib/images/avatars/dog-big.png";
  import dogLittle from "../../lib/images/avatars/dog-little.png";
  import dog1 from "../../lib/images/avatars/dog1.png";
  import dolphinFun from "../../lib/images/avatars/dolphin-fun.png";
  import dolphin from "../../lib/images/avatars/dolphin.png";
  import elephant from "../../lib/images/avatars/elephant.png";
  import elephant2 from "../../lib/images/avatars/elephant2.png";
  import fishGold from "../../lib/images/avatars/fish-gold.png";
  import giraffe from "../../lib/images/avatars/giraffe.png";
  import lion from "../../lib/images/avatars/lion.png";
  import monkey from "../../lib/images/avatars/monkey.png";
  import mosquito from "../../lib/images/avatars/mosquito.png";
  import mouse from "../../lib/images/avatars/mouse.png";
  import panda from "../../lib/images/avatars/panda.png";
  import penguin from "../../lib/images/avatars/penguin.png";
  import tiger from "../../lib/images/avatars/tiger.png";

  const avatars = [
    bear,
    bearTeddy,
    birdSing,
    bird,
    bird2,
    cat,
    crab,
    crocodile,
    dino,
    dogBig,
    dogLittle,
    dog1,
    dolphin,
    dolphinFun,
    elephant,
    elephant2,
    fishGold,
    giraffe,
    lion,
    monkey,
    mosquito,
    mouse,
    panda,
    penguin,
    tiger,
  ];

  let selectedAvatar = "";
  let ndk;
  let name = "";
  let pubKey = "";
  let privKey = "";
  let avatar = "";
  let showModal = false;

  onMount(async () => {
    privKey = decryptKey(localStorage.getItem("secure"));
    const signer = new NDKPrivateKeySigner(privKey);
    ndk = new NDK({ explicitRelayUrls: [RELAY_URL], signer });
    await ndk.connect();

    pubKey = (await signer.user()).npub;
    const profile = await getUserProfile(ndk, pubKey);
    name = profile.name || "";
    avatar = profile.avatar || "";
  });

  function selectAvatar(av) {
    selectedAvatar = av;
    showModal = false;
    avatar = av;
  }

  async function save() {
    if (!selectedAvatar) {
      selectedAvatar = avatar;
    }

    try {
      const avatar = `${selectedAvatar}`;
      await setProfileData(ndk, name, avatar);
    } catch (error) {
      console.error("Error saving profile data:", error);
      alert("Failed to save profile data. Please try again.");
    }
  }

  function showAvatars() {
    showModal = true;
  }
</script>

<main>
  {#if showModal}
    <Modal bind:showModal>
      <!-- <div class="grid grid-cols-2 md:grid-cols-3 gap-4"> -->
        <br>
        <br>
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
        <!-- </div> -->
      </div></Modal
    >
  {/if}
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
              class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 bg-gray-900"
              placeholder="Name"
            />

          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
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
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">
              Your private key -
            </dt>
            <dd>
              <p
                class="mt-1 text-xs leading-6 text-gray-400 sm:col-span-2 sm:mt-0"
              >
                Your password, but cannot be changed, we recommend you saving it
                in you password manager or keep secure.
              </p>
              <p
                class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 break-words"
              >
                {privKey}
              </p>
            </dd>
          </div>
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-300">Avatar</dt>
            <dd>
              <img
                class="h-12 w-12 flex-none rounded-full bg-gray-50"
                src={avatar}
                alt="avatar"
                on:click={showAvatars}
              />
            </dd>
          </div>
          <button
            on:click={save}
            class="float-right text-white bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-teal-300 dark:focus:ring-teal-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
            >Save</button
          >
        </dl>
      </div>
    </div>
  </div>
</main>
