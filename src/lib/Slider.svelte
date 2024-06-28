<script>
  import { onMount } from 'svelte';
  import noUiSlider from 'nouislider';
  import 'nouislider/dist/nouislider.css';

  let slider;
  export let minValue = 20;
  export let maxValue = 40;

  onMount(() => {
    noUiSlider.create(slider, {
      start: [minValue, maxValue],
      connect: true,
      range: {
        min: 1,
        max: 100,
      },
      format: {
        to: (value) => Math.round(value),
        from: (value) => Number(value),
      },
    });

    slider.noUiSlider.on('update', (values) => {
      minValue = Math.round(Number(values[0]));
      maxValue = Math.round(Number(values[1]));
    });
  });

</script>

<div class="slider-container" bind:this={slider}></div>

<style>
  .slider-container {
    width: 100%;
    margin: 20px 0;
  }
</style>
