<script>
  import { createEventDispatcher } from 'svelte';
  import { getRandomAvatar } from './avatars';
  import citiesData from './cities.json';
  import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

  export let name = "";
  export let privKey = "";

  let query = '';
  let results = [];
  let city = null;

  const dispatch = createEventDispatcher();
  const dispatchCitySelection = createEventDispatcher();
  
  let hasAccount = false;
  let loading = false;
  let isNameValid = false;

  const switchHasAccount = () => {
    hasAccount = !hasAccount;
  };

  const onUpdateName = () => {
    name = name;
        isNameValid = name.length >= 3;
  };

  const handleRegister = async () => {
    loading = true;
    try {
      const signer = NDKPrivateKeySigner.generate();
      let avatar = getRandomAvatar() 
      dispatchRegisteredEvent({name, avatar, city, signer});
      localStorage.setItem('user', name );
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

  const handleSignin = async () => {
    loading = true;
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

  function dispatchLoggedInEvent(privKey) {
    dispatch('login', { privKey });
  }

  function dispatchRegisteredEvent({name, avatar, city, signer}) {
    dispatch('register', { name, avatar, city, signer });
  }

  function searchCities(query) {
    const normalizedQuery = query.toLowerCase().trim();
    results = citiesData
      .filter(city => city.name.toLowerCase().startsWith(normalizedQuery))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
  }

  function handleInput(event) {
    query = event.target.value;
    city = null;
    searchCities(query);
    dispatchCitySelection('change', { city });
  }

  function selectCity(c) {
    city = { "cityName": c.name, "cityCountry": c.country };
    query = `${c.name}, ${c.country}`;
    results = [];
    dispatchCitySelection('change', { city });
  }

</script>

  <div class=" justify-center px-8 py-12 w-66 h-96 scrollbar-hidden overflow-y-scroll">
  {#if hasAccount}
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2
        class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900"
      >
        Log in
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="form-widget" on:submit|preventDefault="{handleSignin}">
        <div>
          <label
            for="privkey"
            class="block text-sm font-medium leading-6 text-gray-900"
            >Private key</label
          >
          <div class="mt-2">
            <input
              id="privkey"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
              type="password"
              bind:value={privKey}
            /> 
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
          on:click={switchHasAccount}
          class="font-semibold leading-6 text-teal-600 hover:text-teal-500"
          >Register</button
        >
      </p>
    </div>
  {:else}
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2
        class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900"
      >
        Join us
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto  sm:max-w-sm">
      <form class="form-widget" on:submit|preventDefault="{handleRegister}">
        <div>
          <div class="mt-2">
            <input
              id="name"
              class="block w-full rounded-md border-0 py-1.5 pl-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
              type="text"
              placeholder="name or nickname"
              required
              bind:value={name}
              on:change={onUpdateName}
            />
          </div>
          <div>
            <div class="mt-2 relative">
              <input
                id="city"
                class="block w-full rounded-md border-0 py-1.5 pl-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
                type="text"
                placeholder="city"
                required
                bind:value={query}
                on:input={handleInput}
              />
              {#if results.length > 0}
                <div class="absolute z-10 w-full bg-white rounded-md shadow-lg max-h-60 overflow-y-auto scrollbar-hidden">
                  {#each results as city}
                    <button class="block w-full p-2 text-left cursor-pointer hover:bg-gray-200" on:click={() => selectCity(city)}>
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
        Already have account?
        <button
          on:click={switchHasAccount}
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