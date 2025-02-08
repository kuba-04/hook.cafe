<script lang="ts">
    import FlippingCard from "$lib/FlippingCard.svelte";
    import { page } from "$app/stores";
    import Footer from "./Footer.svelte";

    export let onClose: () => void;

    let isModal: boolean = $page.route.id !== "/inspiration";
    let isImage1: boolean = true;

    const toggleImages = (): void => {
        isImage1 = !isImage1;
    };
</script>

<section class="relative flex items-center justify-center h-screen bg-black">
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-100" : "opacity-0"}`}
        style="background-image: url('/images/inspiration/front-cartoon.png')"
    ></div>
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-0" : "opacity-100"}`}
        style="background-image: url('/images/inspiration/front.jpg')"
    ></div>

    <div
        role="button"
        tabindex="0"
        class="relative z-10 bg-amber-50 bg-opacity-75 rounded-2xl p-5 flex flex-col items-center justify-center w-11/12 max-w-2xl"
        on:mouseenter={toggleImages}
        on:mouseleave={toggleImages}
    >
        <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
            Mediterranean lifestyle in your city?
        </h1>
        <p class="mt-2 text-2xl text-center text-gray-700">
            People are happier and live longer when they spend time together,
            especially during meals 🫒
            <br /><br />
            But do you always have your family or friends around for a quick lunch
            break? 🤗
            <br /><br />
            At Hook Cafe you can find people of the same values nearby so you can
            go out and have a real chat!
        </p>
    </div>
</section>
<div class="relative flex items-center justify-center h-200 bg-black">
    <h1 class="text-4xl font-bold text-center text-amber-50 py-20">
        How does it work?
    </h1>
</div>

<section class="relative flex items-center justify-center h-screen bg-black">
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-100" : "opacity-0"}`}
        style="background-image: url('/images/inspiration/discuss-cartoon.png'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #1
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                Choose your keywords, location and time
            </h1>
        </div>
    </div>
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-0" : "opacity-100"}`}
        style="background-image: url('/images/inspiration/discuss.jpg'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #1
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                Choose your keywords, location and time
            </h1>
        </div>
    </div>
</section>

<div class="relative flex items-center justify-center h-200 bg-black">
    <div class="py-20"></div>
</div>

<section class="relative flex items-center justify-center h-screen bg-black">
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-100" : "opacity-0"}`}
        style="background-image: url('/images/inspiration/book-cartoon.png'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #2
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                Pick someone you like
            </h1>
        </div>
    </div>
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-0" : "opacity-100"}`}
        style="background-image: url('/images/inspiration/book.jpg'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #2
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                Pick someone you like
            </h1>
        </div>
    </div>
</section>

<div class="relative flex items-center justify-center h-200 bg-black">
    <div class="py-20"></div>
</div>

<section class="relative flex items-center justify-center h-screen bg-black">
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-100" : "opacity-0"}`}
        style="background-image: url('/images/inspiration/table-cartoon.png'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #3
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                If 4 people of similar interest match, we'll help you eat out
                together
            </h1>
        </div>
    </div>
    <div
        class={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${isImage1 ? "opacity-0" : "opacity-100"}`}
        style="background-image: url('/images/inspiration/table.jpg'); background-position: center; background-size: cover;"
    >
        <div
            role="button"
            tabindex="0"
            class="absolute z-10 bg-amber-50 bg-opacity-50 rounded-2xl p-5 flex flex-col items-center justify-center w-8/12 max-w-md"
            style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            on:mouseenter={toggleImages}
            on:mouseleave={toggleImages}
        >
            <h1 class="text-6xl font-bold text-center text-gray-700 py-5">
                #3
            </h1>
            <h1 class="text-4xl font-bold text-center text-gray-700 py-5">
                If 4 people of similar interest match, we'll help you eat out
                together
            </h1>
        </div>
    </div>
</section>

<div class="relative flex items-center justify-center h-200 bg-black">
    <div class="py-20"></div>
</div>

<div class="flex justify-center p-8 text-2xl bg-black">
    <div
        class="p-6 mx-auto text-gray-700 bg-amber-50 rounded-2xl bg-opacity-80"
    >
        <h2 class="text-2xl font-bold text-center mb-4">
            What can you gain from this?
        </h2>
        <br />
        <ul class="space-y-6">
            <li class="flex items-center">
                <span class="flex items-center justify-center mr-5"> 👋 </span>
                <span class="ml-2"
                    >You will meet like-minded people you have a little chance
                    to meet in your daily routine</span
                >
            </li>

            <li class="flex items-center">
                <span class=" flex items-center justify-center mr-5"> 🍕 </span>
                <span class="ml-2"
                    >Don't eat alone! Meet real people and have some discussion!</span
                >
            </li>

            <li class="flex items-center">
                <span class=" flex items-center justify-center mr-5"> 😅 </span>
                <span class="ml-2"
                    >You don't want awkward 1:1 date with a stranger? Join a
                    group and chill out!
                </span>
            </li>

            <li class="flex items-center">
                <span class=" flex items-center justify-center mr-5"> 👫 </span>
                <span class="ml-2"
                    >Maybe you are a couple and want to meet another couple with
                    similar values?
                </span>
            </li>
        </ul>
    </div>
</div>

<div class="relative flex items-center justify-center h-200 bg-black">
    <div class="py-20"></div>
</div>

<div class="flex flex-wrap bg-black justify-center">
    <FlippingCard
        imageSrc="/images/inspiration/street.jpg"
        textFront="Don't rush, enjoy"
        textBack="Don't just eat and rush back to work, digest slowly, enjoy the moment 🕖"
    />
    <FlippingCard
        imageSrc="/images/inspiration/opportunity.jpg"
        textFront="Opportunity to meet"
        textBack="You can always learn something new from other people 📖"
    />
    <FlippingCard
        imageSrc="/images/inspiration/lunch.jpg"
        textFront="Reduce the stress"
        textBack="Enjoy peaceful conversations with like-minded people ☀️"
    />
</div>

<div class="relative flex items-center justify-center h-200 bg-black">
    <div class="py-20"></div>
</div>

<section class="relative flex items-center justify-center h-screen bg-black">
    <div
        class="absolute inset-0 bg-cover bg-no-repeat"
        style="background-image: url('/images/inspiration/oldmen.jpg'); background-position: center; background-size: cover;"
    >
        <div
            class="absolute z-10 bg-amber-50 bg-opacity-70 p-5 flex items-start justify-center w-8/10 max-w-md"
            style="top: 20%; left: 50%; transform: translate(-50%, -50%);"
        >
            <h1
                class="text-4xl md:text-4xl sm:text-2xl font-bold text-center text-gray-700 py-5 px-2"
            >
                Inspired by Mediterranean travels..
            </h1>
        </div>
    </div>
</section>

<div class="flex items-center justify-center h-200 bg-black">
    <div class="py-20">
        {#if isModal}
            <div
                class="cursor-pointer"
                role="button"
                tabindex="0"
                on:click={onClose}
                on:keydown={(e) => e.key === "Enter" && onClose()}
            >
                <h1 class="text-4xl font-bold text-center text-amber-50 py-5">
                    Back to app
                </h1>
            </div>
        {:else}
            <a href="/">
                <h1 class="text-4xl font-bold text-center text-amber-50 py-5">
                    Back to app
                </h1>
            </a>
        {/if}
    </div>
</div>

{#if !isModal}
    <Footer />
{/if}

<style>
    .bg-img {
        background-size: cover;
        background-position: center;
        height: 100vh;
    }
</style>
