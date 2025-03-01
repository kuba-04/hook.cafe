<script lang="ts">
    import type { NDKEvent, NDKUserProfile } from "@nostr-dev-kit/ndk";
    import NDK from "@nostr-dev-kit/ndk";
    import { env } from "$env/dynamic/public";

    export let eventData: NDKEvent;
    let profile: NDKUserProfile | null = null;

    async function getUserProfile(pubkey: string): Promise<void> {
        const ndk = new NDK({ explicitRelayUrls: [env.PUBLIC_RELAY_URL] });
        await ndk.connect();
        const user = ndk.getUser({ pubkey });
        profile = await user.fetchProfile();
    }

    if (eventData) {
        getUserProfile(eventData.pubkey);
    }
</script>

<div
    class="flex items-center p-4 mb-4 text-md rounded-lg bg-red-300 text-gray-800 opacity-90"
    role="alert"
>
    <div class="flex min-w-0 gap-x-7">
        <div class="flex min-w-10 items-center">
            {#if !profile?.image}
                <div class="avatarLoader">Loading...</div>
            {:else}
                <img
                    class="w-10 h-10 p-1 rounded-full ring-2 ring-gray-300 dark:ring-gray-500"
                    src={profile.image}
                    alt="profile"
                />
            {/if}
        </div>
        <div class="grid grid-cols-1 gap-0 content-center">
            <p class="text-md font-medium flex items-center gap-2">
                {profile?.name || "Someone"} can't join you today
                <span class="text-3xl">☹️</span>
            </p>
        </div>
    </div>
</div>

<style>
    .avatarLoader {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #3498db;
        animation: spin 1s linear infinite;
        margin: auto;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
