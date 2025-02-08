<script lang="ts">
    export let imageSrc: string;
    export let textFront: string;
    export let textBack: string;
</script>

<div class="perspective w-full max-w-md">
    <div
        class="relative w-full h-64 transition-transform duration-500 transform-style preserve-3d hover:rotate-y-180"
    >
        <!-- Front Side -->
        <div class="relative w-full h-full">
            <div class="absolute inset-0 backface-hidden p-2">
                <img
                    src={imageSrc}
                    alt="img"
                    class="w-full h-full object-cover"
                />
            </div>
            <div class="absolute inset-0 flex items-center justify-center">
                <!-- <input type="text" placeholder="Your text here" class="text-center p-2 bg-white rounded bg-amber-100 bg-opacity-50" /> -->
                <h1 class="text-center p-2 text-amber-50 text-5xl text-center">
                    {textFront}
                </h1>
            </div>
        </div>
        <!-- Back Side -->
        <div
            class="absolute inset-0 bg-black text-amber-50 flex items-center justify-center backface-hidden rotate-y-180"
        >
            <p class="text-2xl p-5 text-center">{textBack}</p>
        </div>
    </div>
</div>

<style>
    .perspective {
        perspective: 1000px;
    }
    .backface-hidden {
        backface-visibility: hidden;
    }
    .rotate-y-180 {
        transform: rotateY(180deg);
    }
    .hover\:rotate-y-180:hover {
        transform: rotateY(180deg);
    }
    .transform-style {
        transform-style: preserve-3d; /* Fixing the class name */
    }
</style>
