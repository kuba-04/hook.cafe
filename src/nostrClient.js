// Import the package
import NDK from "@nostr-dev-kit/ndk";


// Create a new NDK instance with explicit relays
const ndk = new NDK({
    explicitRelayUrls: ["http://127.0.0.1:8080  "],
});

await ndk.connect();

// Create a filter
let filter = { kinds: [1] };

// Will return only the first event
let event = await ndk.fetchEvent(filter);