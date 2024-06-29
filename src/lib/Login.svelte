<script>
  import { recreateSigner, register } from './authUtils';
  import { createEventDispatcher } from 'svelte';

  export let name = "";
  export let privKey = "";

  const dispatch = createEventDispatcher();
  
  let hasAccount = false;
  let loading = false;
  let isNameValid = false;

  const switchHasAccount = () => {
    hasAccount = !hasAccount;
  };

  const onUpdateName = () => {
    name = name;
    isNameValid = name.length >= 4;
  };

  const handleRegister = async () => {
    loading = true;
    try {
      register();
      dispatchRegisteredEvent(name);
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
      recreateSigner(privKey);
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

  function dispatchRegisteredEvent(name) {
    dispatch('register', { name });
  }

</script>

<div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
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
        Start
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="form-widget" on:submit|preventDefault="{handleRegister}">
        <div>
          <label
            for="email"
            class="block text-sm font-medium leading-6 text-gray-900"
            >Name/nickname</label
          >
          <div class="mt-2">
            <input
              id="name"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm sm:leading-6"
              type="text"
              required
              bind:value={name}
              on:change={onUpdateName}
            />
          </div>
        </div>
        

        <div class="mt-2">
          <button
            disabled={!isNameValid}
            on:click={handleRegister}
            type="submit"
            class="flex w-full justify-center rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >Start</button
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

<style lang="postcss">
  :global(html) {
    background-color: theme(colors.gray.100);
  }
</style>
