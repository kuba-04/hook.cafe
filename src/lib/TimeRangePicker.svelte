<script>
    import { createEventDispatcher } from 'svelte';
  
    export let startTime = '12:00';
    export let endTime = '13:00';
    const dispatch = createEventDispatcher();

  function handleStartTimeChange(event) {
    startTime = event.target.value;
    dispatchChangeEvent();
  }

  function handleEndTimeChange(event) {
    endTime = event.target.value;
    dispatchChangeEvent();
  }

  function dispatchChangeEvent() {
    dispatch('change', { startTime, endTime });
  }
  </script>
  
  <div class="time-picker">
    <div class="time-input-container">
      <input type="time" id="start-time" bind:value={startTime} on:change={handleStartTimeChange} class="time-input" step="900" />
    </div>
  
    <div class="time-input-container">
      <input type="time" id="end-time" bind:value={endTime} on:change={handleEndTimeChange} class="time-input" step="900" />
    </div>
  </div>
  
  <style>
    .time-picker {
      display: flex;
      align-items: center;
      gap: 20px;
    }
  
    .time-input-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
  
    .time-input {
      font-size: 1.2rem;
      padding: 5px;

      border-radius: 4px;
      width: 120px;
      background-color: #f5f5dc00; /* Pale brown background */
      color: #ffffff; /* Pale brown text color */
    }
  
    .time-input::-webkit-calendar-picker-indicator {
      filter: invert(50%);
    }
  
    @media (max-width: 600px) {
      .time-picker {
        flex-direction: column;
        align-items: flex-start;
      }
  
      .time-input {
        font-size: 1rem;
        padding: 8px;
        width: 100%;
      }
    }
  </style>
  