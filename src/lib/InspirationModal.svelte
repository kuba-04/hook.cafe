<script lang="ts">
  import Footer from "./Footer.svelte";

  export let showInspirationModal: boolean;
  let dialog: HTMLDialogElement;

  $: if (dialog && showInspirationModal) {
    dialog.showModal();
  }

  export function closeModal(): void {
    dialog?.close();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
  bind:this={dialog}
  on:close={() => (showInspirationModal = false)}
  on:click|self={() => dialog.close()}
>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div on:click|stopPropagation>
    <slot name="header" />
    <slot />
    <div class="absolute top-0 right-0 h-16 w-16">
      <p class="mt-4 text-4xl leading-8 text-black items-end">
        <button on:click={() => dialog.close()}>✖️</button>
      </p>
    </div>
  </div>
  <Footer />
</dialog>

<style lang="postcss">
  dialog {
    border-radius: 1em;
    border: none;
    padding: 0;
    opacity: 90%;
    background-color: black;
    overflow: auto;
    width: 100%;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 1);
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

  body.overflow-hidden {
    overflow: hidden;
  }
</style>
