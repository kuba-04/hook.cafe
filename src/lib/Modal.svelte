<script>
  export let showModal; // boolean

  let dialog; // HTMLDialogElement

  $: if (dialog && showModal) dialog.showModal();

  export function closeModal() {
    dialog.close();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
  bind:this={dialog}
  on:close={() => (showModal = false)}
  on:click|self={() => dialog.close()}
>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div on:click|stopPropagation>
    <slot name="header" />
    <slot />
    <div class="absolute top-0 right-0 h-16 w-16">
      <p class="mt-4 text-lg leading-8 text-gray-600 items-end">
        <button on:click={() => dialog.close()} >close</button>
      </p>
    </div>
  </div>
</dialog>

<style lang="postcss">
    ::content {
      background-color: rgb(17, 16, 15);
    }
  dialog {
    max-width: 32em;
    border-radius: 1em;
    border: none;
    padding: 0;
    opacity: 90%;
    background-color:antiquewhite;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.3);
  }
  dialog > div {
    padding: 1em;
  }
  dialog[open] {
    animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes zoom {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }
  dialog[open]::backdrop {
    animation: fade 0.2s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  button {
    display: block;
  }
</style>
