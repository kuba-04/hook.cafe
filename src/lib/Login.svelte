<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getRandomAvatar } from "./avatars";
  import citiesData from "./cities_tz.json";
  import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
  import { nip19 } from "nostr-tools";

  interface City {
    cityName: string;
    cityCountry: string;
    tz: string;
  }

  interface CityResult {
    name: string;
    country: string;
    population: number;
    tz: string;
  }

  export let name = "";
  export let secretKey = ""; // we allow to log in with either hex and nsec
  export let privKey = "";
  export let nsec = "";

  let query = "";
  let results: CityResult[] = [];
  let city: City | null = null;

  const dispatch = createEventDispatcher();
  const dispatchCitySelection = createEventDispatcher();

  let hasAccount = false;
  let loading = false;
  let isNameValid = false;

  const switchHasProfile = (): void => {
    hasAccount = !hasAccount;
  };

  const onUpdateName = (): void => {
    name = name;
    isNameValid = name.length >= 3;
  };

  const handleRegister = async (): Promise<void> => {
    loading = true;
    try {
      const signer = NDKPrivateKeySigner.generate();
      let avatar = getRandomAvatar();
      dispatchRegisteredEvent({ name, avatar, city, signer });
      localStorage.setItem("user", name);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        console.log(error);
      }
    } finally {
      loading = false;
    }
  };

  const handleSignin = async (): Promise<void> => {
    loading = true;

    if (secretKey && secretKey.startsWith("nsec")) {
      try {
        privKey = nip19.decode(secretKey).data as string;
        new NDKPrivateKeySigner(privKey);
        nsec = secretKey;
      } catch (e) {
        console.log("invalid key");
      }
    } else {
      try {
        new NDKPrivateKeySigner(secretKey);
        privKey = secretKey;
        nsec = nip19.nsecEncode(new TextEncoder().encode(privKey));
      } catch (e) {
        console.log("invalid key");
      }
    }

    try {
      new NDKPrivateKeySigner(privKey);
      dispatchLoggedInEvent(privKey);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        console.log(error);
      }
    } finally {
      loading = false;
    }
  };

  function dispatchLoggedInEvent(privKey: string): void {
    dispatch("login", { privKey });
  }

  function dispatchRegisteredEvent({
    name,
    avatar,
    city,
    signer,
  }: {
    name: string;
    avatar: string;
    city: City | null;
    signer: NDKPrivateKeySigner;
  }): void {
    dispatch("register", { name, avatar, city, signer });
  }

  function searchCities(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    results = citiesData
      .filter((city) => city.name.toLowerCase().startsWith(normalizedQuery))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
  }

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    query = target.value;
    city = null;
    searchCities(query);
    dispatchCitySelection("change", { city });
  }

  function selectCity(c: CityResult): void {
    city = { cityName: c.name, cityCountry: c.country, tz: c.tz };
    query = `${c.name}, ${c.country}`;
    results = [];
    dispatchCitySelection("change", { city });
  }
</script>

<div
  class="justify-center px-8 py-12 w-full max-w-md h-96 scrollbar-hidden overflow-y-scroll"
>
  {#if hasAccount}
    <div class="sm:mx-auto sm:w-full">
      <h2
        class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900"
      >
        Log in
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full">
      <form class="form-widget" on:submit|preventDefault={handleSignin}>
        <div>
          <label
            for="secretKey"
            class="block text-sm font-medium leading-6 text-gray-900"
            >Private key</label
          >
          <div class="mt-2 relative">
            <input
              id="secretKey"
              class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6 pr-8"
              type="password"
              bind:value={secretKey}
            />
            {#if secretKey}
              <button
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                on:click={() => {
                  secretKey = "";
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

        <div class="mt-2">
          <button
            on:click={handleSignin}
            type="submit"
            class="flex w-full justify-center rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >Sign in</button
          >
        </div>
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Don't have the account?
        <button
          on:click={switchHasProfile}
          class="font-semibold leading-6 text-teal-600 hover:text-teal-500"
          >Register</button
        >
      </p>
    </div>
  {:else}
    <div class="sm:mx-auto sm:w-full">
      <h2
        class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900"
      >
        Join us
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto">
      <form class="form-widget" on:submit|preventDefault={handleRegister}>
        <div>
          <div class="mt-2">
            <div class="relative">
              <input
                id="name"
                class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6 pr-8"
                type="text"
                placeholder="name or nickname"
                required
                bind:value={name}
                on:change={onUpdateName}
              />
              {#if name}
                <button
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  on:click={() => {
                    name = "";
                    onUpdateName();
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
          <div>
            <div class="mt-2 relative">
              <input
                id="city"
                class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6 pr-8"
                type="text"
                placeholder="city"
                required
                bind:value={query}
                on:input={handleInput}
              />
              {#if query}
                <button
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  on:click={() => {
                    query = "";
                    city = null;
                    results = [];
                    dispatchCitySelection("change", { city });
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
                  class="absolute z-10 w-full bg-white rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-hidden"
                >
                  {#each results as city}
                    <button
                      class="block w-full p-2 text-left cursor-pointer hover:bg-gray-200 text-sm truncate"
                      on:click={() => selectCity(city)}
                    >
                      {city.name}, {city.country}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="mt-2">
          <button
            disabled={!isNameValid || !city}
            on:click={handleRegister}
            type="submit"
            class="flex w-full justify-center rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >Join</button
          >
        </div>
      </form>

      <!-- <div>
        {#if pubKey}
          <div>
            <p class="mt-10 text-center text-sm text-gray-500">Your public key:</p>
            <p class="break-words">{pubKey}</p>
            <p class="italic text-sm text-italic font-small leading-6 text-gray-400">
              This is your ID, by which other people can find you.
            </p>
          </div>

          <div>
            <p class="mt-10 text-center text-sm text-gray-500">Your private key:</p>
            <p class="break-words">{privKey}</p>
            <p class="italic text-sm text-italic font-small leading-6 text-gray-400">
              This is your password. Please store it in you favourite Password Manager or note down somewhere. We don't store your password, so will not be able to send it to you again.
            </p>
          </div>
          
        {:else if loading}
          <p>Generating keys and connecting...</p>
        {/if}
      </div> -->

      <p class="mt-10 text-center text-sm text-gray-500">
        Been here before?
        <button
          on:click={switchHasProfile}
          class="font-semibold leading-6 text-teal-600 hover:text-teal-500"
          >Log in</button
        >
      </p>
    </div>
  {/if}
</div>

<style>
  .scrollbar-hidden::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge, and Firefox */
  .scrollbar-hidden {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
</style>
