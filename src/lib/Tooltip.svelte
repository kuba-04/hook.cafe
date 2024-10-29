<script>
    export let text = '';
    export let position = 'top'; // You can change this to 'bottom', 'left', or 'right' if needed
    let showTooltip = false;
  
    const handleMouseEnter = () => {
      showTooltip = true;
    };
  
    const handleMouseLeave = () => {
      showTooltip = false;
    };
  
    const handleFocus = () => {
      showTooltip = true;
    };
  
    const handleBlur = () => {
      showTooltip = false;
    };
  </script>
  
  <div class="relative inline-block">
    <span 
      class="cursor-pointer" 
      on:mouseenter={handleMouseEnter} 
      on:mouseleave={handleMouseLeave} 
      on:focus={handleFocus} 
      on:blur={handleBlur}
      tabindex="0" 
      role="button" 
      aria-haspopup="true" 
      aria-expanded={showTooltip}
    >
      <slot />
    </span>
  
    {#if showTooltip}
      <div 
        class={`absolute ${position === 'top' ? '-translate-y-full mb-2' : 'mt-2'} 
                  left-1/2 transform -translate-x-1/2 
                  bg-gray-700 text-white text-sm rounded px-2 py-1`}
      >
        {text}
      </div>
    {/if}
  </div>
  