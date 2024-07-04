<script>
  export let password = "";
  let showPassword = false;
  let showAlert = false;

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function copyPassword() {
    navigator.clipboard
      .writeText(password)
      .then(() => {
        showAlert = true;
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      }).finally(() => setTimeout(() => showAlert = false, 1500));
  }
</script>

<div class="password-container">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    readonly
    class="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0 bg-gray-900"
  />
  <button on:click={togglePasswordVisibility} class="toggle-visibility">
    {showPassword ? "👁️" : "👁️‍🗨️"}
  </button>
  <button on:click={copyPassword} class="copy-button"> 📋 </button>
  {#if showAlert}
  <div class="max-h-4  text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
    <span class="font-medium">Copied!</span>
  </div>
  {/if}
</div>

<style>
  .password-container {
    display: flex;
    align-items: center;
  }

  .toggle-visibility,
  .copy-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    padding: 5px;
  }
</style>
